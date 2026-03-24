"use client";

import { useState } from "react";
import { usePlayer } from "@/context/PlayerContext";
import { DownloadedLecture } from "@/hooks/useDownloads";
import MarqueeText from "@/components/MarqueeText";

interface Props {
  open: boolean;
  onClose: () => void;
  downloads: DownloadedLecture[];
  onDelete: (id: number) => void;
  getBlobUrl: (id: number) => Promise<string | null>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DownloadsPanel({ open, onClose, downloads, onDelete, getBlobUrl }: Props) {
  const { play } = usePlayer();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const totalSize = downloads.reduce((s, d) => s + d.fileSize, 0);

  const handlePlay = async (item: DownloadedLecture) => {
    setLoadingId(item.id);
    const blobUrl = await getBlobUrl(item.id);
    setLoadingId(null);
    if (!blobUrl) return;
    play({
      id: item.id,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      audioUrl: blobUrl,
      videoUrl: "",
      transcript: item.transcript ?? "",
      date: item.date,
      speaker: item.speaker,
      place: item.place,
      category: item.category,
    });
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-4xl xl:max-w-6xl bg-[#0d0d0d] flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h2 className="text-white text-lg font-semibold">Downloads</h2>
              {downloads.length > 0 && (
                <p className="text-gray-500 text-xs">
                  {downloads.length} lecture{downloads.length !== 1 ? "s" : ""} · {formatSize(totalSize)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24">
          {downloads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600 px-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-14 h-14">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <p className="text-sm">No downloads yet.<br />Tap ⋮ on any lecture to download.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-900">
              {downloads.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-4 h-4 opacity-80">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <MarqueeText text={item.title} className="text-white text-sm font-medium leading-snug" />
                      <p className="text-gray-500 text-xs mt-0.5">
                        {[item.speaker, formatDate(item.date)].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-gray-600 text-xs">{formatSize(item.fileSize)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end justify-between flex-shrink-0">
                      <button
                        onClick={() => handlePlay(item)}
                        disabled={loadingId === item.id}
                        className="flex items-center gap-1 text-orange-400 text-xs font-medium"
                      >
                        {loadingId === item.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                          </svg>
                        )}
                        Play
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-red-500/50 hover:text-red-500 transition-colors"
                        title="Remove download"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Transcript accordion */}
                  {item.transcript && (
                    <div className="mt-2 ml-[76px]">
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="flex items-center gap-1 text-gray-500 text-xs"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform ${expandedId === item.id ? "rotate-90" : ""}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                        Transcript
                      </button>
                      {expandedId === item.id && (
                        <p className="mt-1.5 text-gray-400 text-xs leading-relaxed max-h-40 overflow-y-auto border-l-2 border-gray-700 pl-2">
                          {item.transcript}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
