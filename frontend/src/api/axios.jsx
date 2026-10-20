import axios from "axios";

// Normalise VITE_API_URL so a trailing slash or "/api" never breaks requests.
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const API = axios.create({
  baseURL: API_BASE,
  // Render's free tier sleeps after ~15 min of inactivity and can take
  // 30-60s to cold-start. Default axios behaviour is "never time out",
  // which makes the browser fail unpredictably instead of reporting a
  // clear error. 60s covers a cold start while still failing eventually.
  timeout: 60000,
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;