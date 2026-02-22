"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Playlist, PlaylistLecture } from "@/hooks/usePlaylists";

interface Props {
  open: boolean;
  playlists: Playlist[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onRemoveLecture: (playlistId: string, lectureId: number) => void;
  onCreatePlaylist: (name: string) => void;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Playlist detail (drill-down) ─────────────────────────────────────────────
function PlaylistDetail({
  playlist,
  onBack,
  onDelete,
  onRemove,
}: {
  playlist: Playlist;
  onBack: () => void;
  onDelete: () => void;
  onRemove: (lectureId: number) => void;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h2 className="text-white text-base font-semibold leading-tight">{playlist.name}</h2>
            <p className="text-gray-500 text-xs">{playlist.lectures.length} lecture{playlist.lectures.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-gray-500 hover:text-red-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      {/* Delete confirm banner */}
      {confirmDelete && (
        <div className="flex items-center justify-between bg-red-950/60 border-b border-red-900 px-4 py-3 flex-shrink-0">
          <p className="text-red-400 text-sm">Delete this playlist?</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(false)} className="text-gray-400 text-sm">Cancel</button>
            <button onClick={onDelete} className="text-red-400 text-sm font-semibold">Delete</button>
          </div>
        </div>
      )}

      {/* Lectures */}
      <div className="flex-1 overflow-y-auto">
        {playlist.lectures.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600 text-center px-8">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h10.5" />
            </svg>
            <p className="text-sm">No lectures yet.<br />Use ⋮ on any lecture to add it here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-900">
            {playlist.lectures.map((lec: PlaylistLecture, idx: number) => (
              <div
                key={lec.id}
                onClick={() => router.push(`/${lec.id}`)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span className="text-gray-600 text-xs w-5 text-right flex-shrink-0">{idx + 1}</span>
                <div className="w-14 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={lec.thumbnailUrl} alt={lec.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium line-clamp-1">{lec.title}</p>
                  <p className="text-gray-500 text-xs">{[lec.speaker, formatDate(lec.date)].filter(Boolean).join(" • ")}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(lec.id); }}
                  className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Playlist card (thumbnail collage) ────────────────────────────────────────
function PlaylistCard({ playlist, onClick }: { playlist: Playlist; onClick: () => void }) {
  const thumbs = playlist.lectures.slice(0, 4).map((l) => l.thumbnailUrl);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left py-3 px-5 hover:bg-white/5 transition-colors border-b border-gray-900 last:border-0"
    >
      {/* Thumbnail collage */}
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800 grid grid-cols-2 gap-px">
        {thumbs.length === 0 && (
          <div className="col-span-2 row-span-2 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h10.5" />
            </svg>
          </div>
        )}
        {thumbs.length === 1 && (
          <img src={thumbs[0]} alt="" className="col-span-2 row-span-2 w-full h-full object-cover" />
        )}
        {thumbs.length >= 2 && thumbs.map((t, i) => (
          <img key={i} src={t} alt="" className="w-full h-full object-cover" />
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">{playlist.name}</p>
        <p className="text-gray-500 text-xs mt-0.5">
          {playlist.lectures.length} lecture{playlist.lectures.length !== 1 ? "s" : ""}
        </p>
      </div>

      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-600 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export default function PlaylistsPanel({ open, playlists, onClose, onDelete, onRemoveLecture, onCreatePlaylist }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedPlaylist = playlists.find((p) => p.id === selectedId) ?? null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreatePlaylist(newName.trim());
    setNewName("");
    setCreating(false);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setSelectedId(null);
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
        {/* Drill-down: playlist detail */}
        {selectedPlaylist ? (
          <PlaylistDetail
            playlist={selectedPlaylist}
            onBack={() => setSelectedId(null)}
            onDelete={() => handleDelete(selectedPlaylist.id)}
            onRemove={(lectureId) => onRemoveLecture(selectedPlaylist.id, lectureId)}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-gray-800 flex-shrink-0">
              <button onClick={onClose} className="text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
              <h2 className="text-white text-lg font-semibold flex-1">Playlists</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ── PUBLIC PLAYLISTS ── */}
              <div className="px-5 pt-5 pb-2">
                <p className="text-[11px] font-semibold tracking-widest text-gray-500">PUBLIC PLAYLISTS</p>
              </div>
              <div className="mx-5 mb-4 rounded-2xl border border-gray-800 bg-gray-900/40 p-5 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Coming Soon</p>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                    Curated collections by the admin will appear here — organised by scripture, festival, or topic.
                  </p>
                </div>
              </div>

              {/* ── MY PLAYLISTS ── */}
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <p className="text-[11px] font-semibold tracking-widest text-gray-500">MY PLAYLISTS</p>
                <button
                  onClick={() => setCreating((v) => !v)}
                  className="flex items-center gap-1 text-orange-400 text-xs font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New
                </button>
              </div>

              {/* Create playlist input */}
              {creating && (
                <div className="flex items-center gap-2 px-5 pb-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder="Playlist name…"
                    autoFocus
                    className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold px-3 py-2.5 rounded-lg"
                  >
                    Create
                  </button>
                  <button onClick={() => { setCreating(false); setNewName(""); }} className="text-gray-500 p-1">
                    ✕
                  </button>
                </div>
              )}

              {/* Playlist list */}
              {playlists.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-gray-600 text-center px-8">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h10.5" />
                  </svg>
                  <p className="text-sm">No playlists yet.<br />Tap <span className="text-orange-400 font-medium">+ New</span> to create one.</p>
                </div>
              ) : (
                <div className="pb-8">
                  {playlists.map((pl) => (
                    <PlaylistCard key={pl.id} playlist={pl} onClick={() => setSelectedId(pl.id)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
