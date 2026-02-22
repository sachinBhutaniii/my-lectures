"use client";

import { useState } from "react";
import { Playlist, PlaylistLecture } from "@/hooks/usePlaylists";

interface Props {
  open: boolean;
  lecture: PlaylistLecture | null;
  playlists: Playlist[];
  lecturePlaylistIds: string[];
  onClose: () => void;
  onCreate: (name: string) => void;
  onToggle: (playlistId: string) => void;
}

export default function AddToPlaylistModal({
  open,
  lecture,
  playlists,
  lecturePlaylistIds,
  onClose,
  onCreate,
  onToggle,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName("");
    setCreating(false);
  };

  if (!lecture) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/70 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Bottom sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto
          bg-[#111] rounded-t-2xl transition-transform duration-300 ease-out
          ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-3 border-b border-gray-800">
          <p className="text-gray-400 text-xs mb-0.5">Add to playlist</p>
          <p className="text-white font-semibold text-sm line-clamp-1">{lecture.title}</p>
        </div>

        {/* Create new playlist row */}
        <div className="px-5 pt-3">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-3 w-full text-left py-2"
            >
              <span className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-orange-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <span className="text-orange-400 font-medium text-sm">Create new playlist</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Playlist name…"
                autoFocus
                className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold px-3 py-2 rounded-lg"
              >
                Create
              </button>
              <button onClick={() => { setCreating(false); setNewName(""); }} className="text-gray-500 px-1 py-2">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Playlist list */}
        <div className="max-h-64 overflow-y-auto px-5 pb-2">
          {playlists.length === 0 && !creating && (
            <p className="text-gray-600 text-sm py-4 text-center">
              No playlists yet. Create one above.
            </p>
          )}
          {playlists.map((pl) => {
            const added = lecturePlaylistIds.includes(pl.id);
            const thumb = pl.lectures[0]?.thumbnailUrl;
            return (
              <button
                key={pl.id}
                onClick={() => onToggle(pl.id)}
                className="flex items-center gap-3 w-full text-left py-2.5 border-b border-gray-900 last:border-0"
              >
                {/* Thumbnail or placeholder */}
                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800">
                  {thumb ? (
                    <img src={thumb} alt={pl.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h10.5" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{pl.name}</p>
                  <p className="text-gray-500 text-xs">
                    {pl.lectures.length} lecture{pl.lectures.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Checkbox */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  added ? "bg-orange-500 border-orange-500" : "border-gray-600"
                }`}>
                  {added && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Done button */}
        <div className="px-5 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
