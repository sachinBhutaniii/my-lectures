"use client";

import { useEffect, useState } from "react";

export interface PlaylistLecture {
  id: number;
  title: string;
  thumbnailUrl: string;
  category?: string[];
  date?: string;
  place?: { city: string; country: string };
  speaker?: string;
  addedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  lectures: PlaylistLecture[];
}

const KEY = "bdd_playlists";

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPlaylists(JSON.parse(raw));
    } catch {}
  }, []);

  const save = (updated: Playlist[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch {}
    setPlaylists(updated);
  };

  const createPlaylist = (name: string): Playlist => {
    const playlist: Playlist = {
      id: `pl_${Date.now()}`,
      name: name.trim(),
      createdAt: Date.now(),
      lectures: [],
    };
    save([...playlists, playlist]);
    return playlist;
  };

  const deletePlaylist = (id: string) => {
    save(playlists.filter((p) => p.id !== id));
  };

  const addToPlaylist = (playlistId: string, lecture: Omit<PlaylistLecture, "addedAt">) => {
    save(
      playlists.map((p) =>
        p.id !== playlistId
          ? p
          : p.lectures.some((l) => l.id === lecture.id)
          ? p // already in playlist
          : { ...p, lectures: [...p.lectures, { ...lecture, addedAt: Date.now() }] }
      )
    );
  };

  const removeFromPlaylist = (playlistId: string, lectureId: number) => {
    save(
      playlists.map((p) =>
        p.id !== playlistId
          ? p
          : { ...p, lectures: p.lectures.filter((l) => l.id !== lectureId) }
      )
    );
  };

  const isInPlaylist = (playlistId: string, lectureId: number) =>
    playlists.find((p) => p.id === playlistId)?.lectures.some((l) => l.id === lectureId) ?? false;

  const lecturePlaylistIds = (lectureId: number) =>
    playlists.filter((p) => p.lectures.some((l) => l.id === lectureId)).map((p) => p.id);

  return {
    playlists,
    createPlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    isInPlaylist,
    lecturePlaylistIds,
  };
}
