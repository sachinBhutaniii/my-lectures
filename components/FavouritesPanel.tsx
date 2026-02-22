"use client";

import { useRouter } from "next/navigation";
import { FavouriteItem } from "@/hooks/useFavourites";

interface Props {
  open: boolean;
  items: FavouriteItem[];
  onClose: () => void;
  onUnfavourite: (id: number) => void;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FavouritesPanel({ open, items, onClose, onUnfavourite }: Props) {
  const router = useRouter();

  const handlePlay = (item: FavouriteItem) => {
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

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0d0d0d] flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-gray-800">
          <button onClick={onClose} className="text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h2 className="text-white text-lg font-semibold">Favourites</h2>
          <span className="text-gray-500 text-sm">({items.length})</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600 px-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-14 h-14">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <p className="text-sm">No favourites yet.<br />Tap the ♥ on any lecture to save it here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-900">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handlePlay(item)}
                  className="flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                >
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

                  {/* Unfavourite button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onUnfavourite(item.id); }}
                    className="flex-shrink-0 self-center text-red-500 p-1"
                    title="Remove from favourites"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
