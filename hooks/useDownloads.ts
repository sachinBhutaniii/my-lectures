"use client";

import { useState, useEffect, useCallback } from "react";
import { LectureVideo } from "@/types/videos";

export interface DownloadedLecture {
  id: number;
  title: string;
  thumbnailUrl: string;
  date?: string;
  speaker?: string;
  place?: { city: string; country: string };
  category?: string[];
  transcript?: string;
  downloadedAt: number;
  fileSize: number;
}

const DB_NAME = "bdd_downloads";
const STORE_NAME = "audio_blobs";
const META_KEY = "bdd_downloads_meta";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBlob(id: number, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getBlob(id: number): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function deleteBlob(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function loadMeta(): DownloadedLecture[] {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveMeta(list: DownloadedLecture[]) {
  localStorage.setItem(META_KEY, JSON.stringify(list));
}

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadedLecture[]>([]);
  const [progress, setProgress] = useState<Record<number, number>>({});

  useEffect(() => {
    setDownloads(loadMeta());
  }, []);

  const isDownloaded = useCallback(
    (id: number) => downloads.some((d) => d.id === id),
    [downloads]
  );

  const getDownloadProgress = useCallback(
    (id: number): number | null => progress[id] ?? null,
    [progress]
  );

  const downloadLecture = useCallback(async (lecture: LectureVideo) => {
    if (!lecture.audioUrl) return;
    const id = lecture.id;
    setProgress((p) => ({ ...p, [id]: 0 }));

    try {
      const proxyUrl = `/api/download?url=${encodeURIComponent(lecture.audioUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Fetch failed");

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body!.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        setProgress((p) => ({
          ...p,
          [id]: total > 0 ? Math.round((received / total) * 100) : 50,
        }));
      }

      const blob = new Blob(chunks, { type: "audio/mpeg" });
      await saveBlob(id, blob);

      const meta: DownloadedLecture = {
        id: lecture.id,
        title: lecture.title,
        thumbnailUrl: lecture.thumbnailUrl,
        date: lecture.date,
        speaker: lecture.speaker,
        place: lecture.place,
        category: lecture.category,
        transcript: lecture.transcript,
        downloadedAt: Date.now(),
        fileSize: blob.size,
      };

      const updated = [...loadMeta().filter((d) => d.id !== id), meta];
      saveMeta(updated);
      setDownloads(updated);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setProgress((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  }, []);

  const deleteDownload = useCallback(async (id: number) => {
    await deleteBlob(id);
    const updated = loadMeta().filter((d) => d.id !== id);
    saveMeta(updated);
    setDownloads(updated);
  }, []);

  const getBlobUrl = useCallback(async (id: number): Promise<string | null> => {
    const blob = await getBlob(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, []);

  return { downloads, isDownloaded, getDownloadProgress, downloadLecture, deleteDownload, getBlobUrl };
}
