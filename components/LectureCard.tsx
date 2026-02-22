"use client";

import { useState, useRef, useEffect } from "react";
import { LectureVideo } from "@/types/videos";

interface Props {
  lecture: LectureVideo;
  isActive: boolean;
  isFavourite?: boolean;
  onClick: () => void;
  onToggleFavourite?: (e: React.MouseEvent) => void;
  onAddToPlaylist?: () => void;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LectureCard({ lecture, isActive, isFavourite, onClick, onToggleFavourite, onAddToPlaylist }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const location = lecture.place
    ? `${lecture.place.city}${lecture.place.country ? ", " + lecture.place.country : ""}`
    : "";

  return (
    <div
      onClick={onClick}
      className={`mb-3 rounded-xl p-3 cursor-pointer transition-all ${
        isActive
          ? "border border-orange-500 bg-[#2a1f10]"
          : "bg-[#241a0e] border border-transparent"
      }`}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-20">
          <div className="w-20 h-14 rounded-lg overflow-hidden">
            <img
              src={lecture.thumbnailUrl}
              alt={lecture.title}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Dotted progress indicator */}
          <div className="flex gap-0.5 mt-1.5 justify-center">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`h-0.5 w-1.5 rounded-full ${
                  isActive && i < 5 ? "bg-orange-500" : "bg-gray-600"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-white text-sm font-semibold leading-snug line-clamp-2 flex-1">
              {lecture.title}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Favourite toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavourite?.(e); }}
                className="p-0.5"
                title={isFavourite ? "Remove from favourites" : "Add to favourites"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={isFavourite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={isFavourite ? 0 : 1.8}
                  className={`w-4 h-4 transition-colors ${isFavourite ? "text-red-500" : "text-gray-500"}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
              {/* 3-dot menu */}
              <div ref={menuRef} className="relative">
                <button
                  className="text-gray-400 text-lg leading-none px-0.5"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                >
                  ⋮
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-6 z-30 bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-xl min-w-[160px] overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onAddToPlaylist?.();
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-200 hover:bg-white/10 transition-colors text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-orange-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add to Playlist
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date and location */}
          {(lecture.date || location) && (
            <p className="text-gray-400 text-xs mt-0.5">
              {[formatDate(lecture.date), location].filter(Boolean).join(" • ")}
            </p>
          )}

          {/* Category */}
          {lecture.category && lecture.category.length > 0 && (
            <p className="text-blue-400 text-xs mt-0.5">{lecture.category[0]}</p>
          )}

          {/* Comments */}
          <div className="flex items-center gap-1 mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-gray-400 text-xs">Comments (0)</span>
          </div>
        </div>
      </div>

      {/* Progress bar — shown when active */}
      {isActive && (
        <div className="mt-2.5">
          <div className="flex justify-end mb-0.5">
            <span className="text-gray-400 text-xs">0%</span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full w-0" />
          </div>
        </div>
      )}
    </div>
  );
}
