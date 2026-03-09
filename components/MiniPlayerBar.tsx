"use client";

import { usePathname, useRouter } from "next/navigation";
import { usePlayer } from "@/context/PlayerContext";

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MiniPlayerBar() {
  const { lecture, isPlaying, currentTime, duration, pause, resume, stop } = usePlayer();
  const pathname = usePathname();
  const router = useRouter();

  // Hide on lecture page or when nothing is loaded
  if (!lecture || pathname === `/${lecture.id}`) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto w-full max-w-4xl xl:max-w-6xl">
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-800">
          <div
            className="h-full bg-orange-500 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="bg-[#1a1208] border-t border-orange-900/30 px-3 py-2.5 flex items-center gap-3">
          {/* Thumbnail — tap to return to lecture */}
          <button
            onClick={() => router.push(`/${lecture.id}`)}
            className="flex-shrink-0 active:scale-95 transition-transform duration-100"
          >
            <img
              src={lecture.thumbnailUrl}
              alt={lecture.title}
              className="w-10 h-10 rounded-md object-cover"
            />
          </button>

          {/* Title + time — tap to return to lecture */}
          <button
            onClick={() => router.push(`/${lecture.id}`)}
            className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity duration-100"
          >
            <p className="text-white text-xs font-semibold truncate leading-tight">
              {lecture.title}
            </p>
            <p className="text-gray-500 text-[11px] mt-0.5">
              {formatTime(currentTime)}
              {duration > 0 ? ` / ${formatTime(duration)}` : ""}
            </p>
          </button>

          {/* Play / Pause */}
          <button
            onClick={isPlaying ? pause : resume}
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

          {/* Close / Stop */}
          <button
            onClick={stop}
            className="text-gray-500 hover:text-gray-300 flex-shrink-0 active:scale-90 transition-transform"
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
