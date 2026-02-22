"use client";

import { useEffect, useState } from "react";

export interface HistoryItem {
  id: number;
  title: string;
  thumbnailUrl: string;
  category?: string[];
  date?: string;
  place?: { city: string; country: string };
  speaker?: string;
  playedAt: number; // Date.now()
}

const KEY = "bdd_playback_history";

export function usePlaybackHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const addToHistory = (lecture: {
    id: number;
    title: string;
    thumbnailUrl: string;
    category?: string[];
    date?: string;
    place?: { city: string; country: string };
    speaker?: string;
  }) => {
    setHistory((prev) => {
      // Remove existing entry for the same lecture (dedup)
      const deduped = prev.filter((h) => h.id !== lecture.id);
      const updated: HistoryItem[] = [
        { ...lecture, playedAt: Date.now() },
        ...deduped,
      ].slice(0, 50); // cap at 50 items
      try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const clearHistory = () => {
    try { localStorage.removeItem(KEY); } catch {}
    setHistory([]);
  };

  return { history, addToHistory, clearHistory };
}
