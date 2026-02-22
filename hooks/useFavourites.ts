"use client";

import { useEffect, useState } from "react";

export interface FavouriteItem {
  id: number;
  title: string;
  thumbnailUrl: string;
  category?: string[];
  date?: string;
  place?: { city: string; country: string };
  speaker?: string;
  addedAt: number;
}

const KEY = "bdd_favourites";

export function useFavourites() {
  const [items, setItems] = useState<FavouriteItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  const toggleFavourite = (lecture: {
    id: number;
    title: string;
    thumbnailUrl: string;
    category?: string[];
    date?: string;
    place?: { city: string; country: string };
    speaker?: string;
  }) => {
    setItems((prev) => {
      const exists = prev.some((f) => f.id === lecture.id);
      const updated = exists
        ? prev.filter((f) => f.id !== lecture.id)
        : [{ ...lecture, addedAt: Date.now() }, ...prev];
      try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const isFavourite = (id: number) => items.some((f) => f.id === id);

  return { favouriteItems: items, isFavourite, toggleFavourite };
}
