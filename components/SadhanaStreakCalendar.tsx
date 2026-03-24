"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MON_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS  = ["S","M","T","W","T","F","S"];

// ── Streak calc ───────────────────────────────────────────────────────────

function calcCurrentStreak(validDays: Set<string>, today: string): number {
  let streak = 0;
  let d = validDays.has(today) ? today : addDays(today, -1);
  for (;;) {
    if (validDays.has(d)) { streak++; d = addDays(d, -1); }
    else break;
  }
  return streak;
}

// ── Shared status logic ───────────────────────────────────────────────────

function getStatus(
  dateStr: string,
  today: string,
  joinedAt: string,
  entryByDate: Record<string, SadhanaEntryResponse>,
  validDays: Set<string>,
): DayStatus {
  if (dateStr < joinedAt) return "pre-join";
  if (dateStr > today)    return "future";
  const entry = entryByDate[dateStr];
  if (entry) return validDays.has(dateStr) ? "green" : "orange";
  return today > addDays(dateStr, 1) ? "red" : "pending";
}

// ── Colour helpers ────────────────────────────────────────────────────────

function cellBg(status: DayStatus): string {
  switch (status) {
    case "green":    return "bg-emerald-500";
    case "orange":   return "bg-orange-500";
    case "red":      return "bg-red-500/80";
    case "pending":  return "bg-gray-800 border border-dashed border-amber-500/30";
    case "future":
    case "pre-join": return "bg-gray-800/30";
  }
}

function cellText(status: DayStatus): string {
  switch (status) {
    case "green":
    case "orange":
    case "red":     return "text-white";
    case "pending": return "text-amber-400/70";
    default:        return "text-gray-600";
  }
}

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  entries: SadhanaEntryResponse[];
  joinedAt: string;
}

export default function SadhanaStreakCalendar({ entries, joinedAt }: Props) {
  const today = useMemo(() => isoDate(new Date()), []);
  const [expanded, setExpanded] = useState(false);

  // Full-calendar state (only used when expanded)
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const stripRef = useRef<HTMLDivElement>(null);

  // Build lookup maps
  const { validDays, entryByDate } = useMemo(() => {
    const validDays   = new Set<string>();
    const entryByDate: Record<string, SadhanaEntryResponse> = {};
    for (const entry of entries) {
      entryByDate[entry.entryDate] = entry;
      const submitted = entry.submittedAt.split("T")[0];
      if (submitted <= addDays(entry.entryDate, 1)) validDays.add(entry.entryDate);
    }
    return { validDays, entryByDate };
  }, [entries]);

  const currentStreak = useMemo(() => calcCurrentStreak(validDays, today), [validDays, today]);
  const totalValidDays = validDays.size;

  // All dates from joinedAt → today for the strip
  const allDates = useMemo(() => {
    const result: string[] = [];
    let d = joinedAt;
    while (d <= today) { result.push(d); d = addDays(d, 1); }
    return result;
  }, [joinedAt, today]);

  // Scroll strip to rightmost (today) on mount / when dates change
  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.scrollLeft = stripRef.current.scrollWidth;
    }
  }, [allDates]);

  // Full-calendar grid
  const calDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay  = new Date(viewYear, viewMonth + 1, 0);
    const pad      = firstDay.getDay();
    const total    = Math.ceil((pad + lastDay.getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(viewYear, viewMonth, 1 - pad + i);
      return { date: isoDate(d), inMonth: d.getMonth() === viewMonth };
    });
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-IN", {
    month: "long", year: "numeric",
  });
  const joinDate = new Date(joinedAt + "T00:00:00");
  const now = new Date();
  const canGoPrev = viewYear > joinDate.getFullYear() || (viewYear === joinDate.getFullYear() && viewMonth > joinDate.getMonth());
  const canGoNext = viewYear < now.getFullYear()      || (viewYear === now.getFullYear()      && viewMonth < now.getMonth());
  function goPrev() { if (viewMonth === 0) { setViewYear(y=>y-1); setViewMonth(11); } else setViewMonth(m=>m-1); }
  function goNext() { if (viewMonth===11) { setViewYear(y=>y+1); setViewMonth(0);  } else setViewMonth(m=>m+1); }

  return (
    <div className="pt-4 pb-2">
      {/* ── Stats row ── */}
      <div className="flex items-center gap-4 px-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">🔥</span>
          <div>
            <p className="text-2xl font-black text-white leading-none">{currentStreak}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">day streak</p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="text-right">
          <p className="text-base font-bold text-emerald-400 leading-none">{totalValidDays}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">total days</p>
        </div>
      </div>

      {/* ── Horizontal date strip ── */}
      <div
        ref={stripRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-1"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {allDates.map((date) => {
          const status  = getStatus(date, today, joinedAt, entryByDate, validDays);
          const d       = new Date(date + "T12:00:00");
          const dayNum  = d.getDate();
          const dayAbbr = DAY_ABBR[d.getDay()];
          const monAbbr = MON_ABBR[d.getMonth()];
          const isToday = date === today;

          // Show month label when it's the 1st or the join date
          const showMonLabel = dayNum === 1 || date === joinedAt;

          return (
            <div
              key={date}
              className="flex-shrink-0 flex flex-col items-center gap-0.5"
              style={{ scrollSnapAlign: "start", width: 44 }}
            >
              <span className="text-[9px] text-gray-600 font-medium h-3 leading-3">
                {showMonLabel ? monAbbr : ""}
              </span>
              <span className="text-[9px] text-gray-500">{dayAbbr}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center relative ${cellBg(status)}`}>
                <span className={`text-xs font-bold ${cellText(status)}`}>{dayNum}</span>
                {isToday && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legend + See more ── */}
      <div className="flex items-center px-4 mt-2 gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          {[
            { color: "bg-emerald-500", label: "On time" },
            { color: "bg-orange-500",  label: "Late" },
            { color: "bg-red-500/80",  label: "Missed" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className={`w-2 h-2 rounded-sm ${color} inline-block`} />
              {label}
            </span>
          ))}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 flex-shrink-0"
        >
          {expanded ? "See less" : "See more"}
        </button>
      </div>

      {/* ── Expanded full calendar ── */}
      {expanded && (
        <div className="px-4 mt-3">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={goPrev} disabled={!canGoPrev}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <p className="text-sm font-semibold text-gray-300">{monthLabel}</p>
            <button onClick={goNext} disabled={!canGoNext}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-gray-600 py-1">{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {calDays.map(({ date, inMonth }) => {
              const status  = getStatus(date, today, joinedAt, entryByDate, validDays);
              const dayNum  = parseInt(date.split("-")[2], 10);
              const isToday = date === today;
              return (
                <div key={date}
                  className={`aspect-square rounded-md flex items-center justify-center relative ${
                    inMonth ? cellBg(status) : "opacity-0 pointer-events-none"
                  }`}>
                  {inMonth && (
                    <>
                      <span className={`text-[11px] ${cellText(status)}`}>{dayNum}</span>
                      {isToday && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70" />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
