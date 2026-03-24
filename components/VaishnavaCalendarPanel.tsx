"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCalendarEvents } from "@/services/calendar.service";
import type { VaishnavaEvent } from "@/types/calendar";
import { FASTING_UPTO_LABELS } from "@/types/calendar";

const MON_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["S","M","T","W","T","F","S"];

interface Props {
  open: boolean;
  onClose: () => void;
  onLectureClick?: (videoId: number) => void;
}

export default function VaishnavaCalendarPanel({ open, onClose, onLectureClick }: Props) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [events,    setEvents]    = useState<VaishnavaEvent[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState<string | null>(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCalendarEvents(viewYear, viewMonth + 1);
      setEvents(data);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (open) fetchEvents();
  }, [open, fetchEvents]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, VaishnavaEvent[]> = {};
    for (const e of events) {
      if (!map[e.eventDate]) map[e.eventDate] = [];
      map[e.eventDate].push(e);
    }
    return map;
  }, [events]);

  const calDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay  = new Date(viewYear, viewMonth + 1, 0);
    const pad      = firstDay.getDay();
    const total    = Math.ceil((pad + lastDay.getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(viewYear, viewMonth, 1 - pad + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      return { dateStr, inMonth: d.getMonth() === viewMonth, day: d.getDate() };
    });
  }, [viewYear, viewMonth]);

  function goPrev() {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); }
    else setViewMonth(m => m-1);
    setSelected(null);
  }
  function goNext() {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); }
    else setViewMonth(m => m+1);
    setSelected(null);
  }

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative mt-auto w-full max-w-md mx-auto bg-[#0f0f0f] rounded-t-3xl overflow-hidden flex flex-col"
           style={{ maxHeight: "92vh" }}>
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-gray-700 mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 text-lg">🪔</span>
            <h2 className="text-white font-bold text-base">Vaishnava Calendar</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-800 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-8">
          {/* Month navigation */}
          <div className="flex items-center justify-between py-3">
            <button onClick={goPrev} className="p-2 rounded-xl text-gray-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <p className="text-white font-semibold text-sm">{MON_LONG[viewMonth]} {viewYear}</p>
            <button onClick={goNext} className="p-2 rounded-xl text-gray-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 mb-4">
              {calDays.map(({ dateStr, inMonth, day }) => {
                const hasEvent = inMonth && !!eventsByDate[dateStr]?.length;
                const isToday  = dateStr === todayStr;
                const isSel    = dateStr === selected;
                return (
                  <button
                    key={dateStr}
                    disabled={!inMonth}
                    onClick={() => setSelected(isSel ? null : dateStr)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${
                      !inMonth ? "opacity-0 pointer-events-none" :
                      isSel    ? "bg-orange-500 text-white" :
                      isToday  ? "bg-orange-500/20 border border-orange-500/50 text-orange-300" :
                                 "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50"
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{day}</span>
                    {hasEvent && (
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${isSel ? "bg-white/80" : "bg-orange-400"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected day events */}
          {selected && (
            <div className="mb-4">
              <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2">
                {new Date(selected + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              {selectedEvents.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">No events on this day</p>
              ) : (
                selectedEvents.map(ev => (
                  <EventCard key={ev.id} event={ev} onLectureClick={onLectureClick} />
                ))
              )}
            </div>
          )}

          {/* This month's events list */}
          {!selected && events.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2">This Month</p>
              {events.map(ev => (
                <EventCard key={ev.id} event={ev} showDate onLectureClick={onLectureClick} />
              ))}
            </div>
          )}
          {!selected && events.length === 0 && !loading && (
            <p className="text-gray-600 text-sm text-center py-6">No events this month</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EventCard({
  event,
  showDate,
  onLectureClick,
}: {
  event: VaishnavaEvent;
  showDate?: boolean;
  onLectureClick?: (videoId: number) => void;
}) {
  return (
    <div className="bg-gray-900/70 rounded-2xl px-4 py-3 mb-2 border border-gray-800">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-white font-semibold text-sm leading-snug flex-1">{event.eventName}</p>
        {showDate && (
          <span className="text-orange-400 text-[11px] font-semibold flex-shrink-0">
            {new Date(event.eventDate + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      {event.tithi && (
        <p className="text-amber-400/80 text-[11px] mb-1">🌙 {event.tithi}</p>
      )}
      {event.fastingUpto && (
        <p className="text-orange-300/70 text-[11px] mb-1">🙏 Fasting upto: {FASTING_UPTO_LABELS[event.fastingUpto]}</p>
      )}
      {event.description && (
        <p className="text-gray-400 text-[12px] leading-relaxed mt-1">{event.description}</p>
      )}
      {event.suggestedVideoId && (
        <button
          onClick={() => onLectureClick?.(event.suggestedVideoId!)}
          className="mt-2.5 w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
          <span className="text-[12px] font-semibold flex-1 text-left truncate">
            {event.suggestedVideoTitle ?? "Watch Lecture"}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
