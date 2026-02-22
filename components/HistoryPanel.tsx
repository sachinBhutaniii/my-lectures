"use client";

import { useRouter } from "next/navigation";
import { HistoryItem } from "@/hooks/usePlaybackHistory";

interface Props {
  open: boolean;
  history: HistoryItem[];
  onClose: () => void;
  onClear: () => void;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HistoryPanel({ open, history, onClose, onClear }: Props) {
  const router = useRouter();

  const handleContinue = (item: HistoryItem) => {
    onClose();
    router.push(`/${item.id}`);
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

      {/* Panel slides from right */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0d0d0d] flex flex-col
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
            <h2 className="text-white text-lg font-semibold">Playback History</h2>
          </div>
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="text-orange-400 text-xs font-medium"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600 px-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-14 h-14">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No playback history yet.<br />Start listening to a lecture.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-900">
              {history.map((item) => (
                <div key={`${item.id}-${item.playedAt}`} className="flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                  {/* Thumbnail */}
                  <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {[item.speaker, formatDate(item.date)].filter(Boolean).join(" • ")}
                    </p>
                    {item.category && item.category.length > 0 && (
                      <p className="text-blue-400 text-xs">{item.category[0]}</p>
                    )}
                  </div>

                  {/* Right side: time + continue */}
                  <div className="flex flex-col items-end justify-between flex-shrink-0">
                    <span className="text-gray-500 text-[10px]">{relativeTime(item.playedAt)}</span>
                    <button
                      onClick={() => handleContinue(item)}
                      className="flex items-center gap-1 text-orange-400 text-xs font-medium mt-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                      </svg>
                      Continue
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
