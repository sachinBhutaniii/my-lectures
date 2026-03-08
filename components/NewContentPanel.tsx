"use client";

import { useEffect } from "react";
import { LectureVideo } from "@/types/videos";

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  open: boolean;
  items: LectureVideo[];
  onClose: () => void;
  onLectureClick: (lecture: LectureVideo) => void;
};

export default function NewContentPanel({ open, items, onClose, onLectureClick }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 bg-[#0d0d0d] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-white text-base font-semibold">What&apos;s New</h2>
            <p className="text-gray-600 text-xs mt-0.5">Added since your last visit</p>
          </div>
          {items.length > 0 && (
            <span className="text-[11px] text-orange-400 font-semibold bg-orange-500/10 border border-orange-500/25 rounded-full px-2.5 py-0.5">
              {items.length} new
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-7 h-7 text-gray-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">You&apos;re all caught up!</p>
                <p className="text-gray-600 text-xs mt-1 leading-relaxed">No new lectures or bhajans since your last visit.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {items.map((lecture) => (
                <button
                  key={lecture.id}
                  onClick={() => { onLectureClick(lecture); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-11 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                    {lecture.thumbnailUrl ? (
                      <img src={lecture.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-6 h-6 text-gray-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-snug line-clamp-2">{lecture.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {lecture.date && (
                        <span className="text-gray-600 text-[11px]">{formatDate(lecture.date)}</span>
                      )}
                      {(lecture.category ?? []).slice(0, 1).map((c) => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 font-medium uppercase">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-700 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
