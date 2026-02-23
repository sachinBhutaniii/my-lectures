"use client";
import { LectureVideo } from "@/types/videos";

type AdminVideoItemProps = {
  video: LectureVideo;
  onEdit: (video: LectureVideo) => void;
};

export default function AdminVideoItem({ video, onEdit }: AdminVideoItemProps) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-800">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-gray-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}

        {/* Edit button overlay */}
        <button
          onClick={() => onEdit(video)}
          className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 hover:bg-orange-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors backdrop-blur-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
          Edit
        </button>

        {/* Private badge */}
        {video.visibility === "PRIVATE" && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500/80 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-[10px] font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            Private
          </div>
        )}

        {/* Category badges */}
        {(video.category ?? []).length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {(video.category ?? []).slice(0, 2).map((cat) => (
              <span key={cat} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/80 text-white uppercase">
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-100 line-clamp-2 leading-snug">{video.title}</h3>
        {video.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{video.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {video.date && (
            <span className="text-[11px] text-gray-600">{video.date}</span>
          )}
          {video.speaker && (
            <span className="text-[11px] text-gray-600">{video.speaker}</span>
          )}
        </div>
        {(video.keywords ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(video.keywords ?? []).slice(0, 3).map((kw) => (
              <span key={kw} className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-800 text-gray-500 border border-gray-700">
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
