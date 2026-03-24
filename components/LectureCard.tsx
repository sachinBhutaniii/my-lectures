"use client";

import { useState, useRef, useEffect } from "react";
import { LectureVideo } from "@/types/videos";

interface Props {
  lecture: LectureVideo;
  isActive: boolean;
  isRecommended?: boolean;
  isFavourite?: boolean;
  isDownloaded?: boolean;
  downloadProgress?: number | null;
  onClick: () => void;
  onToggleFavourite?: (e: React.MouseEvent) => void;
  onAddToPlaylist?: () => void;
  onDownload?: () => void;
  onDeleteDownload?: () => void;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LectureCard({ lecture, isActive, isRecommended, isFavourite, isDownloaded, downloadProgress, onClick, onToggleFavourite, onAddToPlaylist, onDownload, onDeleteDownload }: Props) {
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
            <div className="flex-1 min-w-0">
              {isRecommended && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-400/10 border border-orange-400/30 rounded-full px-2 py-0.5 mb-1">
                  🪔 Recommended
                </span>
              )}
              <p className="text-white text-sm font-semibold leading-snug line-clamp-2">
                {lecture.title}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Download state indicator */}
              {downloadProgress != null && (
                <div className="p-0.5">
                  <span className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin block" />
                </div>
              )}
              {isDownloaded && downloadProgress == null && (
                <div className="p-0.5" title="Downloaded">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-500">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
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
                    {/* Download / downloading / remove download */}
                    {downloadProgress != null ? (
                      <div className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-500">
                        <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        Downloading {downloadProgress}%
                      </div>
                    ) : isDownloaded ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onDeleteDownload?.();
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition-colors text-left"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Remove Download
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onDownload?.();
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-200 hover:bg-white/10 transition-colors text-left"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-orange-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download
                      </button>
                    )}
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
