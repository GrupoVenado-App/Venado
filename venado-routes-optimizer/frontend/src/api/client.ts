import axios from "axios";
import { toast } from "sonner";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
});

export function getToken() {
  return localStorage.getItem("venado_token");
}

export function setSession(token: string, role: string, user: unknown) {
  localStorage.setItem("venado_token", token);
  localStorage.setItem("venado_role", role);
  localStorage.setItem("venado_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("venado_token");
  localStorage.removeItem("venado_role");
  localStorage.removeItem("venado_user");
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || "Error de red";
    if (error.response?.status === 401) {
      clearSession();
    }
    if (!(error.config as { silent?: boolean } | undefined)?.silent) {
      toast.error(message);
    }
    return Promise.reject(error);
  },
);
