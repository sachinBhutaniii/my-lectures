"use client";
// Red notices for failed saves / updates / deletes (see lib/apiRules.ts — "fail loudly").
// They stay until dismissed, so nobody misses that something was not saved.
import { useEffect, useState } from "react";
import { LOUD_ERROR_EVENT, type LoudErrorDetail } from "@/lib/notices";

interface Notice extends LoudErrorDetail {
  id: number;
  at: number;
  count: number;
}

const MAX_NOTICES = 4;

export default function GlobalNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    let nextId = 1;
    const onError = (e: Event) => {
      const d = (e as CustomEvent<LoudErrorDetail>).detail;
      if (!d) return;
      setNotices((prev) => {
        // Same message again → bump its counter instead of stacking duplicates
        const same = prev.find((n) => n.title === d.title && n.detail === d.detail);
        if (same) return prev.map((n) => (n === same ? { ...n, count: n.count + 1, at: Date.now() } : n));
        return [...prev, { ...d, id: nextId++, at: Date.now(), count: 1 }].slice(-MAX_NOTICES);
      });
    };
    window.addEventListener(LOUD_ERROR_EVENT, onError);
    return () => window.removeEventListener(LOUD_ERROR_EVENT, onError);
  }, []);

  if (notices.length === 0) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[1000] w-[min(96vw,30rem)] flex flex-col gap-2" role="alert" aria-live="assertive">
      {notices.map((n) => (
        <div key={n.id} className="flex items-start gap-2.5 rounded-xl border border-red-500/60 bg-red-950/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-100">
              {n.title}
              {n.count > 1 && <span className="ml-1.5 text-[11px] font-normal text-red-300">×{n.count}</span>}
            </p>
            {n.detail && <p className="mt-0.5 text-xs text-red-200/90 break-words">{n.detail}</p>}
            <p className="mt-0.5 text-[10px] text-red-300/60">
              {new Date(n.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
          <button
            onClick={() => setNotices((prev) => prev.filter((x) => x.id !== n.id))}
            className="flex-shrink-0 rounded-md px-1.5 text-red-300 hover:text-white hover:bg-red-800/60"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
