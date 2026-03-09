"use client";

import { useRef, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlayer } from "@/context/PlayerContext";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerSheet() {
  const { lecture, isPlaying, currentTime, duration, pause, resume, stop } = usePlayer();
  const pathname = usePathname();
  const router = useRouter();

  const [exiting, setExiting] = useState(false);
  const navigating = useRef(false);
  const touchStartY = useRef(0);
  const touchStartT = useRef(0);

  const onLecturePage = lecture ? pathname === `/${lecture.id}` : false;

  // Reset exit state whenever we're NOT on the lecture page (e.g. after pressing back)
  useEffect(() => {
    if (!onLecturePage) {
      setExiting(false);
      navigating.current = false;
    }
  }, [onLecturePage]);

  if (!lecture || onLecturePage) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // On the home page the BottomNav sits at bottom-0; use 72px to safely clear it
  const navOffset = pathname === "/" ? 72 : 0;

  function goToLecture() {
    if (navigating.current) return;
    navigating.current = true;
    setExiting(true);
    setTimeout(() => router.push(`/${lecture!.id}`), 320);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    touchStartT.current = Date.now();
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const dt = Date.now() - touchStartT.current;
    const isTap = Math.abs(dy) < 8 && dt < 300;
    const isSwipeUp = dy > 15;
    if (isTap || isSwipeUp) {
      e.preventDefault();
      goToLecture();
    }
  }

  return (
    <div
      className="fixed inset-x-0 z-50"
      style={{
        bottom: navOffset,
        transform: exiting ? "translateY(110%)" : "translateY(0)",
        transition: exiting ? "transform 360ms cubic-bezier(0.32, 0.72, 0, 1)" : "none",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={goToLecture}
    >
      <div className="mx-auto w-full max-w-4xl xl:max-w-6xl">
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-800">
          <div className="h-full bg-orange-500" style={{ width: `${progress}%`, transition: "width 1s linear" }} />
        </div>

        {/* Bar */}
        <div className="bg-[#1a1208] border-t border-orange-900/30 px-3 flex items-center gap-3 h-[70px]">
          <img src={lecture.thumbnailUrl} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate leading-tight">{lecture.title}</p>
            <p className="text-gray-500 text-[11px] mt-0.5">
              {fmt(currentTime)}{duration > 0 ? ` / ${fmt(duration)}` : ""}
            </p>
          </div>

          {/* Play / Pause */}
          <button
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); isPlaying ? pause() : resume(); }}
            onClick={(e) => e.stopPropagation()}
            className="text-orange-500 flex-shrink-0 active:scale-90 transition-transform"
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Stop */}
          <button
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); stop(); }}
            onClick={(e) => e.stopPropagation()}
            className="text-gray-500 active:scale-90 transition-transform flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
