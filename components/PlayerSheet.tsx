"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlayer } from "@/context/PlayerContext";
import { useBackClose } from "@/hooks/useBackClose";

const MINI_H = 72; // height of collapsed mini bar in px

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerSheet() {
  const { lecture, isPlaying, currentTime, duration, pause, resume, stop, seekToSeconds, skip } =
    usePlayer();
  const pathname = usePathname();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [maxDrag, setMaxDrag] = useState(10000);
  const [ready, setReady] = useState(false); // suppress transition on first measurement

  const startTouchY = useRef(0);
  const startDragY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const moved = useRef(false);

  // Keep maxDrag in sync with visual viewport height (matches 100dvh, not window.innerHeight)
  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      setMaxDrag(h - MINI_H);
    };
    update();
    setReady(true);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Collapse when navigating to the lecture page
  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  // Back gesture closes the expanded sheet
  useBackClose(expanded, collapse);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const y = e.touches[0].clientY;
      startTouchY.current = y;
      startDragY.current = expanded ? 0 : maxDrag;
      lastY.current = y;
      lastT.current = Date.now();
      moved.current = false;
      setDragging(true);
      setDragY(startDragY.current);
    },
    [expanded, maxDrag]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const y = e.touches[0].clientY;
      const delta = y - startTouchY.current;
      if (Math.abs(delta) > 4) moved.current = true;
      const newY = Math.max(0, Math.min(maxDrag, startDragY.current + delta));
      setDragY(newY);
      lastY.current = y;
      lastT.current = Date.now();
    },
    [maxDrag]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      setDragging(false);

      if (!moved.current) {
        // Pure tap — toggle
        if (expanded) collapse();
        else expand();
        return;
      }

      // Velocity: positive = downward (toward collapse)
      const dt = Date.now() - lastT.current;
      const vy = dt > 0 ? (e.changedTouches[0].clientY - lastY.current) / dt : 0;
      const currentDragY = Math.max(0, Math.min(maxDrag, startDragY.current + (e.changedTouches[0].clientY - startTouchY.current)));

      if (vy > 0.5 || currentDragY > maxDrag * 0.4) {
        collapse();
      } else {
        expand();
      }
    },
    [expanded, expand, collapse, maxDrag]
  );

  const onLecturePage = lecture ? pathname === `/${lecture.id}` : false;
  if (!lecture || onLecturePage) return null;

  const translateY = dragging ? dragY : expanded ? 0 : maxDrag;
  const openRatio = Math.max(0, Math.min(1, 1 - translateY / maxDrag));
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Backdrop — opacity follows finger */}
      <div
        className="fixed inset-0 z-40 bg-black pointer-events-none"
        style={{ opacity: openRatio * 0.65 }}
      />

      {/* Sheet — full height, translateY controls visibility */}
      <div
        className="fixed inset-x-0 bottom-0 z-50"
        style={{
          height: "100dvh",
          transform: `translateY(${translateY}px)`,
          transition: (!ready || dragging) ? "none" : "transform 460ms cubic-bezier(0.32, 0.72, 0, 1)",
          willChange: "transform",
        }}
      >
        {/* ── Expanded "Now Playing" view ── */}
        <div
          className="bg-[#0d0d0d] rounded-t-3xl flex flex-col overflow-hidden"
          style={{
            height: `calc(100dvh - ${MINI_H}px)`,
            opacity: Math.min(1, openRatio * 2.5),
          }}
        >
          {/* Drag handle */}
          <div
            className="w-full pt-3 pb-2 flex-shrink-0 flex justify-center touch-none select-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-5">
            {/* Thumbnail */}
            <div className="w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/60 flex-shrink-0" style={{ aspectRatio: "16/9" }}>
              <img
                src={lecture.thumbnailUrl}
                alt={lecture.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Title */}
            <p className="text-white text-lg font-semibold leading-snug flex-shrink-0">
              {lecture.title}
            </p>

            {/* Progress bar + time */}
            <div className="flex-shrink-0">
              <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-orange-500 rounded-full"
                  style={{ width: `${progress}%`, transition: "width 1s linear" }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={1}
                  value={currentTime}
                  onChange={(e) => seekToSeconds(Number(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1.5">
                <span>{fmt(currentTime)}</span>
                <span>{fmt(duration)}</span>
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-10 flex-shrink-0">
              {/* Rewind 10s */}
              <button
                onClick={() => skip(-10)}
                className="text-gray-400 active:text-white active:scale-90 transition-all"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                  <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                </svg>
              </button>

              {/* Play / Pause */}
              <button
                onClick={isPlaying ? pause : resume}
                className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-orange-500/30"
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Forward 10s */}
              <button
                onClick={() => skip(10)}
                className="text-gray-400 active:text-white active:scale-90 transition-all"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                  <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                </svg>
              </button>
            </div>

            {/* Open full transcript page */}
            <button
              onClick={() => {
                collapse();
                setTimeout(() => router.push(`/${lecture.id}`), 400);
              }}
              className="flex-shrink-0 w-full py-3 rounded-xl border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/10 transition-colors"
            >
              Open Transcript &amp; Queue →
            </button>
          </div>
        </div>

        {/* ── Mini bar (the bottom strip — always the "face" of the sheet) ── */}
        <div
          className="bg-[#1a1208] border-t border-orange-900/30 touch-none select-none"
          style={{ height: MINI_H }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Progress line */}
          <div className="h-0.5 bg-gray-800">
            <div
              className="h-full bg-orange-500"
              style={{ width: `${progress}%`, transition: "width 1s linear" }}
            />
          </div>

          <div className="px-3 flex items-center gap-3" style={{ height: `${MINI_H - 2}px` }}>
            <img
              src={lecture.thumbnailUrl}
              alt=""
              className="w-10 h-10 rounded-md object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-tight">
                {lecture.title}
              </p>
              <p className="text-gray-500 text-[11px] mt-0.5">
                {fmt(currentTime)}
                {duration > 0 ? ` / ${fmt(duration)}` : ""}
              </p>
            </div>
            <button
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                isPlaying ? pause() : resume();
              }}
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
            <button
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                stop();
              }}
              className="text-gray-500 active:scale-90 transition-transform flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
