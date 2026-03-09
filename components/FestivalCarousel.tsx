"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { LectureVideo } from "@/types/videos";

interface Props {
  lectures: LectureVideo[];
  onSelect: (lecture: LectureVideo) => void;
}

export default function FestivalCarousel({ lectures, onSelect }: Props) {
  const slides = lectures.filter((l) => l.thumbnailUrl);
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { currentRef.current = current; }, [current]);

  const goTo = useCallback((idx: number) => {
    setCurrent((prev) => {
      const len = slides.length;
      if (len === 0) return prev;
      const next = ((idx % len) + len) % len;
      currentRef.current = next;
      return next;
    });
  }, [slides.length]);

  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      goTo(currentRef.current + 1);
    }, 4000);
  }, [goTo]);

  useEffect(() => {
    if (slides.length === 0) return;
    startAuto();
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [slides.length, startAuto]);

  // Native touch listeners — must be non-passive to call preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el || slides.length === 0) return;

    let startX = 0;
    let startY = 0;
    let isHorizontal = false;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isHorizontal = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > dy && dx > 5) {
        isHorizontal = true;
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isHorizontal) return;
      const dx = startX - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 30) {
        goTo(currentRef.current + (dx > 0 ? 1 : -1));
        startAuto();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [slides.length, goTo, startAuto]); // re-runs when slides load

  // Always render the outer div so containerRef is always attached
  return (
    <div className="mt-2">
      <div ref={containerRef} className="mx-4 rounded-2xl overflow-hidden h-48 relative">
        {slides.length === 0 ? (
          // Loading skeleton — same dimensions, no ref problem
          <div className="w-full h-full bg-[#241a0e] animate-pulse" />
        ) : (
          <div
            className="flex h-full"
            style={{
              width: `${slides.length * 100}%`,
              transform: `translateX(-${(current / slides.length) * 100}%)`,
              transition: "transform 420ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          >
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="relative h-full cursor-pointer select-none"
                style={{ width: `${100 / slides.length}%` }}
                onClick={() => onSelect(slide)}
              >
                <img
                  src={slide.thumbnailUrl}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
                  <p className="text-white font-bold text-lg leading-snug drop-shadow line-clamp-2">
                    {slide.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); startAuto(); }}
              className={`rounded-full transition-all duration-300 ${
                i === current ? "bg-orange-500 w-5 h-2" : "bg-gray-600 w-2 h-2"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
