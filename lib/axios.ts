import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { TOKEN_KEY, SESSION_EXPIRED_EVENT } from "@/lib/session";
import { API_BASE_URL } from "@/lib/apiBase";
import {
  isWrite, isPublicWrite, isAuthCall, requireLogin, describeFailure, requestLabel,
} from "@/lib/apiRules";
import { showLoudError } from "@/lib/notices";

export { API_BASE_URL };

declare module "axios" {
  interface AxiosRequestConfig {
    /** Background call that must never send the user to the login page (it copes with a lost
     *  login itself, e.g. streak sync or the proofreading activity log). See lib/apiRules.ts. */
    skipLoginRedirect?: boolean;
    /** The caller shows its own visible error for this failure, so no global red notice.
     *  The failure is still logged. See lib/apiRules.ts. */
    skipLoudError?: boolean;
  }
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

class LoginRequiredError extends Error {
  constructor(label: string) {
    super(`Login required for ${label}`);
    this.name = "LoginRequiredError";
  }
}

// ── Before sending: attach the login, and stop writes from logged-out users ──────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") return config;
  const token = localStorage.getItem(TOKEN_KEY);
  // Login / sign-up never carry an old token (a wrong password must not look like an expired login)
  if (token && !isAuthCall(config.url) && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // RULE 1: a save / update / delete needs a login unless the endpoint is whitelisted
  if (isWrite(config.method) && !isPublicWrite(config.url) && !config.headers.Authorization) {
    const label = requestLabel(config.method, config.url);
    if (!config.skipLoginRedirect) requireLogin("Please log in to save. Your change was not saved.");
    else console.warn(`[login required] ${label} not sent: not logged in`);
    return Promise.reject(new LoginRequiredError(label));
  }
  return config;
});

// ── After a failure: lost login → login page; anything else → loud notice ────────────
apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (typeof window === "undefined") return Promise.reject(error);
    const config = error.config;
    const status = error.response?.status;
    const sentToken = !!config?.headers?.Authorization;
    // A 401 on a request that carried a token means the login session has ended
    // (token expired or revoked). Tell AuthContext so the whole app sees it.
    if (status === 401 && sentToken && !isAuthCall(config?.url)) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    if (config && isWrite(config.method) && !isPublicWrite(config.url)) {
      const label = requestLabel(config.method, config.url);
      if (status === 401) {
        if (!config.skipLoginRedirect) {
          requireLogin("Your login has ended. Please log in again — your change was not saved.");
        } else {
          console.warn(`[login required] ${label}: login ended (handled by the caller)`);
        }
      } else if (!config.skipLoudError) {
        // RULE 2: fail loudly
        showLoudError("Could not save", `${describeFailure(status, error.response?.data)} · ${label}`);
      } else {
        console.error(`[save failed] ${label}: ${describeFailure(status, error.response?.data)}`, error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
