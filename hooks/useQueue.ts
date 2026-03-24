"use client";

import { useEffect, useState } from "react";

export interface QueueItem {
  id: number;
  title: string;
  thumbnailUrl: string;
  category?: string[];
  date?: string;
  speaker?: string;
}

const KEY = "bdd_queue";

export function useQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setQueue(JSON.parse(raw));
    } catch {}
  }, []);

  function persist(next: QueueItem[]) {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    setQueue(next);
  }

  function addToQueue(item: QueueItem) {
    setQueue(prev => {
      if (prev.some(q => q.id === item.id)) return prev; // already in queue
      const next = [...prev, item];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function removeFromQueue(id: number) {
    setQueue(prev => {
      const next = prev.filter(q => q.id !== id);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function isInQueue(id: number) {
    return queue.some(q => q.id === id);
  }

  function clearQueue() {
    persist([]);
  }

  return { queue, addToQueue, removeFromQueue, isInQueue, clearQueue };
}
