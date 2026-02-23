"use client";
import { useEffect, useRef, useState } from "react";

export default function TripleTapFullscreen({ children }: { children: React.ReactNode }) {
  const [fsHint, setFsHint] = useState<"entered" | "exited" | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for fullscreen changes (handles hardware back button, ESC key, etc.)
  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const inFS = !!(document.fullscreenElement || doc.webkitFullscreenElement);
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current);
      setFsHint(inFS ? "entered" : "exited");
      hintTimerRef.current = setTimeout(() => setFsHint(null), 1800);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = () => {
    type FSDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    type FSEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const doc = document as FSDoc;
    const el = document.documentElement as FSEl;
    const inFS = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    if (inFS) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };

  const handleTripleTap = (e: React.TouchEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (["INPUT", "TEXTAREA", "BUTTON", "A", "SELECT"].includes(tag)) return;
    const now = Date.now();
    const recent = tapTimesRef.current.filter((t) => now - t < 600);
    recent.push(now);
    tapTimesRef.current = recent;
    if (recent.length >= 3) {
      tapTimesRef.current = [];
      toggleFullscreen();
    }
  };

  return (
    <div className="contents" onTouchEnd={handleTripleTap}>
      {/* Fullscreen hint toast */}
      {fsHint && (
        <div className="fixed inset-x-0 top-14 z-[200] flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/95 border border-gray-700 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            {fsHint === "entered" ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400 flex-shrink-0">
                  <path fillRule="evenodd" d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.75a.75.75 0 0 1 0 1.5H2.5v3.75a.75.75 0 0 1-1.5 0V3.5Zm13.75-.75a.75.75 0 0 1 .75.75V7.25a.75.75 0 0 1-1.5 0V3.5h-3.75a.75.75 0 0 1 0-1.5h3.75A1.5 1.5 0 0 1 17 3.5ZM.75 13.25a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5H2.5A1.5 1.5 0 0 1 1 17.75V14a.75.75 0 0 1 .75-.75Zm18.5 0A.75.75 0 0 1 20 14v3.75A1.5 1.5 0 0 1 18.5 19H14.75a.75.75 0 0 1 0-1.5H18.5V14a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-gray-200">Fullscreen — triple tap to exit</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 flex-shrink-0">
                  <path fillRule="evenodd" d="M4.5 4.5a.75.75 0 0 0-1.06 1.06L6.19 8.31H2.75a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 .75-.75v-5a.75.75 0 0 0-1.5 0v3.44L4.5 4.5Zm11 11a.75.75 0 0 0 1.06-1.06l-2.75-2.75h3.44a.75.75 0 0 0 0-1.5h-5a.75.75 0 0 0-.75.75v5a.75.75 0 0 0 1.5 0v-3.44l2.75 2.75Z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-gray-400">Exited fullscreen</span>
              </>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
