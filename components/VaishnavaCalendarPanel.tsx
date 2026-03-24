"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCalendarEvents } from "@/services/calendar.service";
import type { VaishnavaEvent } from "@/types/calendar";
import { FASTING_UPTO_LABELS } from "@/types/calendar";

const MON_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS  = ["S","M","T","W","T","F","S"];
const DAY_ABBR  = ["Su","Mo","Tu","We","Th","Fr","Sa"];

interface Props {
  open: boolean;
  onClose: () => void;
  onLectureClick?: (videoId: number) => void;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function VaishnavaCalendarPanel({ open, onClose, onLectureClick }: Props) {
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    else       { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [events,    setEvents]    = useState<VaishnavaEvent[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState(false);

  const initializedRef = useRef(false);
  const stripRef       = useRef<HTMLDivElement>(null);
  const eventRefs      = useRef<Record<string, HTMLDivElement | null>>({});

  const todayStr = useMemo(() => isoDate(new Date()), []);

  const threeDaysLaterStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return isoDate(d);
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
    if (open) {
      fetchEvents();
    } else {
      initializedRef.current = false;
      setSelected(null);
      setExpanded(false);
    }
  }, [open, fetchEvents]);

  // Auto-select first upcoming event on initial open, scroll strip + list to it
  useEffect(() => {
    if (!open || events.length === 0 || initializedRef.current) return;
    initializedRef.current = true;
    const upcoming = events
      .filter(e => e.eventDate >= todayStr)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
    if (upcoming) {
      setSelected(upcoming.eventDate);
      setTimeout(() => {
        // Scroll strip to today
        if (stripRef.current) stripRef.current.scrollLeft = stripRef.current.scrollWidth / 2;
        // Scroll event list to the upcoming event
        eventRefs.current[upcoming.eventDate]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [open, events, todayStr]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, VaishnavaEvent[]> = {};
    for (const e of events) {
      if (!map[e.eventDate]) map[e.eventDate] = [];
      map[e.eventDate].push(e);
    }
    return map;
  }, [events]);

  // All days in the current month for the strip
  const stripDays = useMemo(() => {
    const days: string[] = [];
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      days.push(`${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    }
    return days;
  }, [viewYear, viewMonth]);

  // Full grid days
  const calDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay  = new Date(viewYear, viewMonth + 1, 0);
    const pad      = firstDay.getDay();
    const total    = Math.ceil((pad + lastDay.getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(viewYear, viewMonth, 1 - pad + i);
      return { dateStr: isoDate(d), inMonth: d.getMonth() === viewMonth, day: d.getDate() };
    });
  }, [viewYear, viewMonth]);

  function goPrev() {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); }
    else setViewMonth(m => m-1);
    setSelected(null);
    initializedRef.current = true; // don't re-auto-select when navigating
  }
  function goNext() {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); }
    else setViewMonth(m => m+1);
    setSelected(null);
    initializedRef.current = true;
  }

  function selectDay(dateStr: string) {
    setSelected(prev => prev === dateStr ? null : dateStr);
    setTimeout(() => {
      eventRefs.current[dateStr]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  // Scroll strip to today on first render
  useEffect(() => {
    if (open && stripRef.current) {
      const todayIndex = stripDays.indexOf(todayStr);
      if (todayIndex >= 0) {
        const itemW = 52; // approx width of each strip cell
        stripRef.current.scrollLeft = Math.max(0, todayIndex * itemW - 80);
      }
    }
  }, [open, stripDays, todayStr]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative mt-auto w-full max-w-md mx-auto bg-[#0f0f0f] rounded-t-3xl flex flex-col"
        style={{ maxHeight: "88vh" }}
        onTouchMove={e => e.stopPropagation()}
      >
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

        {/* ── Sticky calendar section ── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-gray-800/60">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={goPrev} className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <p className="text-white font-semibold text-sm">{MON_LONG[viewMonth]} {viewYear}</p>
            <button onClick={goNext} className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Horizontal day strip */}
          <div ref={stripRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {stripDays.map(dateStr => {
              const d        = new Date(dateStr + "T12:00:00");
              const hasEvent = !!eventsByDate[dateStr]?.length;
              const isToday  = dateStr === todayStr;
              const isSel    = dateStr === selected;
              const isUpcoming = hasEvent && dateStr >= todayStr && dateStr <= threeDaysLaterStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => selectDay(dateStr)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1.5 transition-all w-11 ${
                    isSel      ? "bg-orange-500" :
                    isUpcoming ? "bg-amber-400/20 border border-amber-400/50" :
                    isToday    ? "bg-orange-500/20 border border-orange-500/40" :
                                 "bg-gray-800/50"
                  }`}
                >
                  <span className={`text-[9px] font-medium ${isSel ? "text-white/80" : "text-gray-500"}`}>
                    {DAY_ABBR[d.getDay()]}
                  </span>
                  <span className={`text-[12px] font-bold ${isSel ? "text-white" : isUpcoming ? "text-amber-300" : isToday ? "text-orange-300" : "text-gray-300"}`}>
                    {d.getDate()}
                  </span>
                  <span className={`w-1 h-1 rounded-full ${hasEvent ? (isSel ? "bg-white/80" : isUpcoming ? "bg-amber-400" : "bg-orange-400") : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>

          {/* See more / See less */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full text-center text-[11px] font-semibold text-orange-400/80 hover:text-orange-400 pt-2 transition-colors"
          >
            {expanded ? "See less ▲" : "See more ▼"}
          </button>

          {/* Full grid (expanded) */}
          {expanded && (
            <div className="mt-2">
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((w, i) => (
                  <div key={i} className="text-center text-[10px] font-bold text-gray-600 py-1">{w}</div>
                ))}
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {calDays.map(({ dateStr, inMonth, day }) => {
                    const hasEvent   = inMonth && !!eventsByDate[dateStr]?.length;
                    const isToday    = dateStr === todayStr;
                    const isSel      = dateStr === selected;
                    const isUpcoming = hasEvent && dateStr >= todayStr && dateStr <= threeDaysLaterStr;
                    return (
                      <button
                        key={dateStr}
                        disabled={!inMonth}
                        onClick={() => selectDay(dateStr)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                          !inMonth    ? "opacity-0 pointer-events-none" :
                          isSel       ? "bg-orange-500 text-white" :
                          isUpcoming  ? "bg-amber-400/20 border border-amber-400/60 text-amber-300" :
                          isToday     ? "bg-orange-500/20 border border-orange-500/50 text-orange-300" :
                                        "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50"
                        }`}
                      >
                        <span className="text-[11px] font-semibold">{day}</span>
                        {hasEvent && (
                          <span className={`w-1 h-1 rounded-full mt-0.5 ${isSel ? "bg-white/80" : isUpcoming ? "bg-amber-400" : "bg-orange-400"}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Scrollable event list ── */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 pb-24 pt-3">
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No events this month</p>
          ) : (
            Object.entries(eventsByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dateStr, dayEvents]) => {
                const isSel      = dateStr === selected;
                const isUpcoming = dateStr >= todayStr && dateStr <= threeDaysLaterStr;
                return (
                  <div
                    key={dateStr}
                    ref={el => { eventRefs.current[dateStr] = el; }}
                    className="mb-4"
                  >
                    <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${
                      isSel ? "text-orange-400" : isUpcoming ? "text-amber-400" : "text-gray-500"
                    }`}>
                      {new Date(dateStr + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                      {isUpcoming && <span className="ml-2 text-amber-400">🪔</span>}
                    </p>
                    {dayEvents.map(ev => (
                      <EventCard key={ev.id} event={ev} onLectureClick={onLectureClick} highlighted={isSel} />
                    ))}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

function EventCard({
  event, highlighted, onLectureClick,
}: {
  event: VaishnavaEvent;
  highlighted?: boolean;
  onLectureClick?: (videoId: number) => void;
}) {
  const [descExpanded, setDescExpanded] = useState(false);

  return (
    <div className={`rounded-2xl px-4 py-3 mb-2 border ${
      highlighted ? "bg-orange-500/8 border-orange-500/30" : "bg-gray-900/70 border-gray-800"
    }`}>
      <p className="text-white font-semibold text-sm leading-snug">{event.eventName}</p>
      {event.tithi && (
        <p className="text-amber-400/80 text-[11px] mt-1">🌙 {event.tithi}</p>
      )}
      {event.fastingUpto && (
        <p className="text-orange-300/70 text-[11px] mt-0.5">🙏 Fasting upto: {FASTING_UPTO_LABELS[event.fastingUpto]}</p>
      )}
      {event.description && (
        <div className="mt-1">
          <p className={`text-gray-400 text-[12px] leading-relaxed whitespace-pre-wrap ${!descExpanded ? "line-clamp-2" : ""}`}>
            {event.description}
          </p>
          {event.description.length > 80 && (
            <button onClick={() => setDescExpanded(v => !v)} className="text-orange-400/80 text-[11px] font-semibold mt-0.5 hover:text-orange-300">
              {descExpanded ? "Read less" : "Read more"}
            </button>
          )}
        </div>
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
