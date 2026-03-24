"use client";

import { useRouter } from "next/navigation";
import { QueueItem } from "@/hooks/useQueue";

interface Props {
  queue: QueueItem[];
  currentId: number;
  onRemove: (id: number) => void;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function QueueList({ queue, currentId, onRemove }: Props) {
  const router = useRouter();

  if (queue.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-700">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
        </svg>
        <p className="text-gray-500 text-sm">Your queue is empty</p>
        <p className="text-gray-700 text-xs">Tap ⋮ on any lecture and choose<br />"Add to Queue"</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {queue.map((item, index) => {
        const isCurrent = item.id === currentId;
        return (
          <div
            key={item.id}
            onClick={() => router.push(`/${item.id}`)}
            className={`flex items-center gap-3 py-3 border-b border-gray-900 cursor-pointer group ${
              isCurrent ? "opacity-100" : "opacity-70 hover:opacity-100"
            }`}
          >
            {/* Queue number / now playing indicator */}
            <div className="w-6 flex-shrink-0 flex justify-center">
              {isCurrent ? (
                <div className="flex flex-col gap-0.5 items-center">
                  {[3, 5, 4].map((h, i) => (
                    <div key={i} className="w-0.5 bg-orange-500 rounded-full animate-pulse" style={{ height: `${h * 2}px` }} />
                  ))}
                </div>
              ) : (
                <span className="text-gray-600 text-xs">{index + 1}</span>
              )}
            </div>

            {/* Thumbnail */}
            <div className="w-14 h-10 rounded-md overflow-hidden flex-shrink-0">
              <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug line-clamp-1 ${isCurrent ? "text-orange-400" : "text-white"}`}>
                {item.title}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {[item.speaker, formatDate(item.date)].filter(Boolean).join(" • ")}
              </p>
              {item.category && item.category.length > 0 && (
                <p className="text-blue-400 text-xs">{item.category[0]}</p>
              )}
            </div>

            {/* Remove button */}
            <button
              className="text-gray-600 hover:text-red-400 transition-colors px-1 opacity-0 group-hover:opacity-100 active:opacity-100"
              onClick={e => { e.stopPropagation(); onRemove(item.id); }}
              title="Remove from queue"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
