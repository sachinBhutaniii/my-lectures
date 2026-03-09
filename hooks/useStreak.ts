"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "@/lib/axios";

const STORAGE_KEY = "bdd_streak_dates";
const DAILY_TIME_KEY = "bdd_daily_listen_time"; // { [YYYY-MM-DD]: seconds }
const TOKEN_KEY = "bdd_auth_token";
export const STREAK_THRESHOLD = 600; // 10 minutes in seconds

// Module-level debounce so multiple hook instances don't fire parallel saves
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      const streakDates: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      const listenTime: Record<string, number> = JSON.parse(localStorage.getItem(DAILY_TIME_KEY) ?? "{}");
      await apiClient.put("/api/users/streak", { streakDates, listenTime }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* non-critical */ }
  }, 5000); // 5-second debounce
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function today(): string {
  return toDateStr(new Date());
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

function calcStreak(sortedDates: string[]): { current: number; longest: number } {
  if (sortedDates.length === 0) return { current: 0, longest: 0 };

  const unique = [...new Set(sortedDates)].sort().reverse(); // newest first

  // Current streak: must include today or yesterday
  const todayStr = today();
  const yestStr = yesterday();
  let current = 0;
  if (unique[0] === todayStr || unique[0] === yestStr) {
    current = 1;
    for (let i = 1; i < unique.length; i++) {
      const prev = new Date(unique[i - 1]);
      const curr = new Date(unique[i]);
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diff === 1) current++;
      else break;
    }
  }

  // Longest streak: iterate ascending
  const asc = [...unique].reverse();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < asc.length; i++) {
    const prev = new Date(asc[i - 1]);
    const curr = new Date(asc[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest };
}

export interface StreakData {
  listenDates: string[];        // YYYY-MM-DD strings of streak days (>= 10 min)
  currentStreak: number;
  longestStreak: number;
  totalDays: number;            // unique streak days
  listenedToday: boolean;       // today >= 10 min
  todaySeconds: number;         // seconds listened today (may be < threshold)
  dailyTimes: Record<string, number>; // seconds listened per day (all days)
}

export function useStreak() {
  const [listenDates, setListenDates] = useState<string[]>([]);
  const [dailyTimes, setDailyTimes] = useState<Record<string, number>>({});

  // Ref to avoid stale closure in addListeningTime
  const dailyTimesRef = useRef<Record<string, number>>({});

  const reloadFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setListenDates(JSON.parse(raw));
    } catch { /* ignore */ }

    try {
      const rawTimes = localStorage.getItem(DAILY_TIME_KEY);
      if (rawTimes) {
        const parsed = JSON.parse(rawTimes);
        setDailyTimes(parsed);
        dailyTimesRef.current = parsed;
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    reloadFromStorage();
    // Re-read from localStorage after backend sync on login
    window.addEventListener("bdd-streak-synced", reloadFromStorage);
    return () => window.removeEventListener("bdd-streak-synced", reloadFromStorage);
  }, [reloadFromStorage]);

  // Add seconds listened — automatically marks streak when threshold is crossed
  const addListeningTime = useCallback((seconds: number) => {
    const t = today();
    const current = dailyTimesRef.current[t] ?? 0;
    const newTotal = current + seconds;

    dailyTimesRef.current = { ...dailyTimesRef.current, [t]: newTotal };
    setDailyTimes({ ...dailyTimesRef.current });
    try {
      localStorage.setItem(DAILY_TIME_KEY, JSON.stringify(dailyTimesRef.current));
    } catch { /* ignore */ }
    scheduleSave();

    // If we just crossed the 10-minute threshold, mark today as a streak day
    if (current < STREAK_THRESHOLD && newTotal >= STREAK_THRESHOLD) {
      setListenDates((prev) => {
        if (prev.includes(t)) return prev;
        const next = [...prev, t];
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        scheduleSave();
        return next;
      });
    }
  }, []);

  const uniqueDates = [...new Set(listenDates)];
  const { current, longest } = calcStreak(uniqueDates);
  const todayStr = today();

  const streakData: StreakData = {
    listenDates: uniqueDates.sort(),
    currentStreak: current,
    longestStreak: longest,
    totalDays: uniqueDates.length,
    listenedToday: uniqueDates.includes(todayStr),
    todaySeconds: dailyTimesRef.current[todayStr] ?? 0,
    dailyTimes: dailyTimesRef.current,
  };

  return { streakData, addListeningTime };
}
