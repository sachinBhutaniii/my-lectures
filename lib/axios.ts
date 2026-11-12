import axios, { AxiosError } from "axios";
import { TOKEN_KEY, SESSION_EXPIRED_EVENT } from "@/lib/session";

// NEXT_PUBLIC_API_URL lets a local dev build talk to a local/test backend.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://bddsm-production.up.railway.app";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT on every request if present
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// A 401 on a request that carried a token means the login session has ended
// (token expired or revoked). Tell AuthContext so the whole app sees it.
apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const sentToken = !!error.config?.headers?.Authorization;
    if (error.response?.status === 401 && sentToken && typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
