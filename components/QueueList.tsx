"use client";

import { useRouter } from "next/navigation";
import { LectureVideo } from "@/types/videos";

interface Props {
  lectures: LectureVideo[];
  currentId: number;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function QueueList({ lectures, currentId }: Props) {
  const router = useRouter();

  if (lectures.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Queue is empty
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {lectures.map((lecture, index) => {
        const isCurrent = lecture.id === currentId;
        return (
          <div
            key={lecture.id}
            onClick={() => router.push(`/${lecture.id}`)}
            className={`flex items-center gap-3 py-3 border-b border-gray-900 cursor-pointer group ${
              isCurrent ? "opacity-100" : "opacity-70 hover:opacity-100"
            }`}
          >
            {/* Queue number / now playing indicator */}
            <div className="w-6 flex-shrink-0 flex justify-center">
              {isCurrent ? (
                <div className="flex flex-col gap-0.5 items-center">
                  {[3, 5, 4].map((h, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-orange-500 rounded-full animate-pulse"
                      style={{ height: `${h * 2}px` }}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-gray-600 text-xs">{index + 1}</span>
              )}
            </div>

            {/* Thumbnail */}
            <div className="w-14 h-10 rounded-md overflow-hidden flex-shrink-0">
              <img
                src={lecture.thumbnailUrl}
                alt={lecture.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium leading-snug line-clamp-1 ${
                  isCurrent ? "text-orange-400" : "text-white"
                }`}
              >
                {lecture.title}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {[
                  lecture.speaker,
                  formatDate(lecture.date),
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
              {lecture.category && lecture.category.length > 0 && (
                <p className="text-blue-400 text-xs">{lecture.category[0]}</p>
              )}
            </div>

            {/* 3-dot menu */}
            <button
              className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity px-1"
              onClick={(e) => e.stopPropagation()}
            >
              ⋮
            </button>
          </div>
        );
      })}
    </div>
  );
}
