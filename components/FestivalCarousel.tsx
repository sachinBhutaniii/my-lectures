"use client";

import { useState, useEffect } from "react";
import { LectureVideo } from "@/types/videos";

interface Props {
  lectures: LectureVideo[];
  onSelect: (lecture: LectureVideo) => void;
}

export default function FestivalCarousel({ lectures, onSelect }: Props) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (lectures.length === 0) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % lectures.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [lectures.length]);

  if (lectures.length === 0) {
    return (
      <div className="mx-4 mt-2 h-48 rounded-2xl bg-[#241a0e] animate-pulse" />
    );
  }

  const slide = lectures[current];

  return (
    <div className="mt-2">
      <div
        className="relative mx-4 rounded-2xl overflow-hidden cursor-pointer h-48"
        onClick={() => onSelect(slide)}
      >
        {/* Background image */}
        <img
          src={slide.thumbnailUrl}
          alt={slide.title}
          className="w-full h-full object-cover"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* Title */}
        <div className="absolute bottom-3 left-4 right-12">
          <p className="text-white font-bold text-lg leading-snug drop-shadow line-clamp-2">
            {slide.title}
          </p>
        </div>

        {/* Share button */}
        <button
          className="absolute bottom-3 right-3 bg-black/40 rounded-full p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-2.5">
        {lectures.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current ? "bg-orange-500 w-5 h-2" : "bg-gray-600 w-2 h-2"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
