import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";

/**
 * Realtime connection to the Express/Socket.IO backend.
 *
 * The backend emits `newTransaction` to the room named after the user's id
 * whenever a transaction is created (e.g. from the WhatsApp webhook).
 *
 * Consumers should watch `version` (an incrementing counter) and refetch their
 * data when it changes. Using a counter instead of the raw payload means two
 * identical transactions still trigger two refreshes.
 */
const SocketContext = createContext(null);

// VITE_API_URL is the backend base URL, e.g. https://smartbudget-api.onrender.com
// Strip a trailing slash and a trailing "/api" so Socket.IO still targets the
// server root (its default path is /socket.io).
const RAW_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SOCKET_URL = RAW_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

function readSession() {
  try {
    const token = localStorage.getItem("token");
    const rawUser = localStorage.getItem("user");
    const user = rawUser ? JSON.parse(rawUser) : null;
    // API returns `id`; older Mongo-shaped sessions used `_id`.
    const userId = user?._id || user?.id || null;
    return { token, userId };
  } catch {
    return { token: null, userId: null };
  }
}

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const seenIdsRef = useRef(new Set());

  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0);
  const [lastTransaction, setLastTransaction] = useState(null);

  const location = useLocation();

  const teardown = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    const { token, userId } = readSession();

    // Not logged in -> make sure nothing is left connected.
    if (!token || !userId) {
      teardown();
      return;
    }

    // Reuse an existing socket instead of creating duplicate connections / listeners.
    if (socketRef.current) {
      if (socketRef.current.connected) {
        socketRef.current.emit("join", userId);
      } else {
        socketRef.current.auth = { token };
        socketRef.current.connect();
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      // WebSocket first, long-polling as a fallback for restrictive proxies.
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // (Re)join on every connect/reconnect.
      socket.emit("join", userId);
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("connect_error", (err) => {
      setConnected(false);
      if (import.meta.env.DEV) {
        console.warn("[socket] connection error:", err.message);
      }
    });

    socket.on("newTransaction", (payload) => {
      const id = payload?._id || payload?.id;

      // Ignore duplicate deliveries of the same transaction.
      if (id) {
        if (seenIdsRef.current.has(id)) return;
        seenIdsRef.current.add(id);
        if (seenIdsRef.current.size > 500) {
          const oldest = seenIdsRef.current.values().next().value;
          seenIdsRef.current.delete(oldest);
        }
      }

      setLastTransaction(payload || null);
      setVersion((v) => v + 1);
    });
  }, [teardown]);

  // Login/logout both navigate, so re-check the session on every route change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();
  }, [location.pathname, connect]);

  // Explicit auth changes + cross-tab logout/login.
  useEffect(() => {
    const onChange = () => connect();

    window.addEventListener("auth-changed", onChange);
    window.addEventListener("storage", onChange);

    return () => {
      window.removeEventListener("auth-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [connect]);

  // Disconnect when the provider is unmounted.
  useEffect(() => () => teardown(), [teardown]);

  const value = useMemo(
    () => ({ connected, version, lastTransaction }),
    [connected, version, lastTransaction]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  const context = useContext(SocketContext);
  // Safe fallback so an individual component never crashes if the provider
  // is missing (it still renders, just without live updates).
  return context || { connected: false, version: 0, lastTransaction: null };
}
