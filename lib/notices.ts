// Loud, visible error notices (rendered by components/GlobalNotices.tsx in the root layout).
export const LOUD_ERROR_EVENT = "bdd-loud-error";

export interface LoudErrorDetail {
  title: string;
  detail?: string;
}

/** Show a red notice to the user AND log it. Use for every failed save / update / delete. */
export function showLoudError(title: string, detail?: string): void {
  console.error(`[${title}] ${detail ?? ""}`);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LoudErrorDetail>(LOUD_ERROR_EVENT, { detail: { title, detail } }));
}
