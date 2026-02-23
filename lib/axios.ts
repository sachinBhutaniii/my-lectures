import axios from "axios";

const apiClient = axios.create({
  baseURL: "https://bddsm-production.up.railway.app",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT on every request if present
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("bdd_auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default apiClient;
