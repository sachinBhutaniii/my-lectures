import { LectureVideo } from "@/types/videos";

interface Props {
  lecture: LectureVideo;
}

export default function MiniPlayer({ lecture }: Props) {
  return (
    <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto z-40">
      {/* Orange progress bar at top */}
      <div className="h-0.5 bg-gray-700">
        <div className="h-full bg-orange-500 w-0" />
      </div>
      <div className="bg-[#1e1409] border-t border-gray-800 px-3 py-2 flex items-center gap-3">
        {/* Thumbnail */}
        <img
          src={lecture.thumbnailUrl}
          alt={lecture.title}
          className="w-10 h-10 rounded-md object-cover flex-shrink-0"
        />

        {/* Title + time */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{lecture.title}</p>
          <p className="text-gray-400 text-xs">0:00 / --:--</p>
        </div>

        {/* Play button */}
        <button className="text-orange-500">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Skip next button */}
        <button className="text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M5.055 7.06c-1.25-.714-2.805.189-2.805 1.628v8.123c0 1.44 1.555 2.342 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.342 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L14.805 7.06C13.555 6.346 12 7.25 12 8.688v2.34L5.055 7.06z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
