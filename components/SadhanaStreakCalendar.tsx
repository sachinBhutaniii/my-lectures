"use client";

import { useMemo, useState } from "react";
import type { SadhanaEntryResponse } from "@/services/sadhana.service";

// ── Date helpers ──────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

type DayStatus = "green" | "orange" | "red" | "pending" | "future" | "pre-join";

interface DayInfo {
  date: string;
  status: DayStatus;
  inCurrentMonth: boolean;
}

// ── Streak calculation ─────────────────────────────────────────────────────
// Walk backwards from today. If today has no valid entry, still start checking
// from today (it might still be filled). Consecutive valid days = current streak.

function calcCurrentStreak(validDays: Set<string>, today: string): number {
  let streak = 0;
  let d = today;
  // If today has no valid entry yet, start from yesterday (today still fillable)
  if (!validDays.has(d)) {
    d = addDays(d, -1);
  }
  for (;;) {
    if (validDays.has(d)) {
      streak++;
      d = addDays(d, -1);
    } else {
      break;
    }
  }
  return streak;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  entries: SadhanaEntryResponse[];
  joinedAt: string; // YYYY-MM-DD
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function SadhanaStreakCalendar({ entries, joinedAt }: Props) {
  const today = useMemo(() => isoDate(new Date()), []);

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0-indexed

  // Build lookup maps from entries
  const { validDays, entryByDate } = useMemo(() => {
    const validDays = new Set<string>();
    const entryByDate: Record<string, SadhanaEntryResponse> = {};
    for (const entry of entries) {
      entryByDate[entry.entryDate] = entry;
      // submittedAt comes as "2026-03-10T14:30:00" from backend
      const submittedDate = entry.submittedAt.split("T")[0];
      const graceCutoff = addDays(entry.entryDate, 1);
      if (submittedDate <= graceCutoff) {
        validDays.add(entry.entryDate);
      }
    }
    return { validDays, entryByDate };
  }, [entries]);

  const currentStreak = useMemo(() => calcCurrentStreak(validDays, today), [validDays, today]);

  // Compute total valid days (for stats)
  const totalValidDays = validDays.size;

  // Calendar grid for viewYear/viewMonth
  const days = useMemo((): DayInfo[] => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startPad = firstDay.getDay(); // 0 = Sunday
    const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;

    const result: DayInfo[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(viewYear, viewMonth, 1 - startPad + i);
      const dateStr = isoDate(d);
      const inCurrentMonth = d.getMonth() === viewMonth;

      let status: DayStatus;
      if (dateStr < joinedAt) {
        status = "pre-join";
      } else if (dateStr > today) {
        status = "future";
      } else {
        const entry = entryByDate[dateStr];
        if (entry) {
          status = validDays.has(dateStr) ? "green" : "orange";
        } else {
          // Red if grace period has expired (today > entryDate + 1 day)
          const gracePeriodExpiry = addDays(dateStr, 1);
          status = today > gracePeriodExpiry ? "red" : "pending";
        }
      }

      result.push({ date: dateStr, status, inCurrentMonth });
    }
    return result;
  }, [viewYear, viewMonth, today, joinedAt, validDays, entryByDate]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // Navigation bounds
  const joinDate = new Date(joinedAt + "T00:00:00");
  const now = new Date();
  const canGoPrev =
    viewYear > joinDate.getFullYear() ||
    (viewYear === joinDate.getFullYear() && viewMonth > joinDate.getMonth());
  const canGoNext =
    viewYear < now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth < now.getMonth());

  function goPrev() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNext() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function dayCellStyle(status: DayStatus, inMonth: boolean): string {
    if (!inMonth) return "opacity-0 pointer-events-none";
    switch (status) {
      case "green":    return "bg-emerald-500";
      case "orange":   return "bg-orange-500";
      case "red":      return "bg-red-500/80";
      case "pending":  return "bg-gray-800 border border-dashed border-amber-500/40";
      case "future":   return "bg-gray-800/30";
      case "pre-join": return "bg-transparent";
    }
  }

  function dayTextStyle(status: DayStatus): string {
    switch (status) {
      case "green":
      case "orange":
      case "red":
        return "text-white font-semibold";
      case "pending":
        return "text-amber-400/70";
      default:
        return "text-gray-600";
    }
  }

  return (
    <div className="px-4 pt-4 pb-3">
      {/* Streak stats row */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl leading-none">🔥</span>
          <div>
            <p className="text-3xl font-black text-white leading-none">{currentStreak}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">day streak</p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="text-right">
          <p className="text-lg font-bold text-emerald-400 leading-none">{totalValidDays}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">total days</p>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-20 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-gray-300">{monthLabel}</p>
        <button
          onClick={goNext}
          disabled={!canGoNext}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-20 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-gray-600 py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, status, inCurrentMonth }) => {
          const dayNum = parseInt(date.split("-")[2], 10);
          const isToday = date === today;
          return (
            <div
              key={date}
              className={`aspect-square rounded-md flex items-center justify-center relative ${dayCellStyle(status, inCurrentMonth)}`}
            >
              {inCurrentMonth && (
                <>
                  <span className={`text-[11px] ${dayTextStyle(status)}`}>{dayNum}</span>
                  {isToday && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70" />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> On time
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" /> Late
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/80 inline-block" /> Missed
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-800 border border-dashed border-amber-500/40 inline-block" /> Pending
        </span>
      </div>
    </div>
  );
}
