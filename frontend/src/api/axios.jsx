import axios from "axios";

// Normalise VITE_API_URL so a trailing slash or "/api" never breaks requests.
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const API = axios.create({
  baseURL: API_BASE,
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;