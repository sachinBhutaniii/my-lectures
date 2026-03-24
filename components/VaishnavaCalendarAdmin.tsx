"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  importIcalEvents,
} from "@/services/calendar.service";
import { getVideos } from "@/services/video.service";
import type { VaishnavaEvent, VaishnavaEventRequest, FastingUpto } from "@/types/calendar";
import { FASTING_UPTO_LABELS } from "@/types/calendar";
import type { LectureVideo } from "@/types/videos";

const FASTING_OPTIONS: { value: FastingUpto; label: string }[] = [
  { value: "NOON",          label: "Noon" },
  { value: "DUSK",          label: "Dusk" },
  { value: "MOON_RISE",     label: "Moon rise" },
  { value: "NEXT_SUNRISE",  label: "Next sunrise" },
];

const EMPTY_FORM: VaishnavaEventRequest = {
  eventDate: "",
  eventName: "",
  description: "",
  tithi: "",
  fastingUpto: undefined,
  suggestedVideoId: undefined,
  suggestedVideoTitle: undefined,
};

export default function VaishnavaCalendarAdmin() {
  const [events,    setEvents]    = useState<VaishnavaEvent[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [importing, setImporting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState<string | null>(null);
  const [form,      setForm]      = useState<VaishnavaEventRequest>(EMPTY_FORM);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lecture search
  const [allVideos,     setAllVideos]     = useState<LectureVideo[]>([]);
  const [lectureSearch, setLectureSearch] = useState("");
  const [showDropdown,  setShowDropdown]  = useState(false);

  // View month
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCalendarEvents(viewYear, viewMonth + 1);
      setEvents(data);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    getVideos().then(res => setAllVideos(res.videos)).catch(() => {});
  }, []);

  const filteredVideos = useMemo(() => {
    const q = lectureSearch.toLowerCase().trim();
    if (!q) return [];
    return allVideos.filter(v => v.title.toLowerCase().includes(q)).slice(0, 8);
  }, [allVideos, lectureSearch]);

  function goPrev() {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); }
    else setViewMonth(m => m-1);
  }
  function goNext() {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); }
    else setViewMonth(m => m+1);
  }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setLectureSearch("");
    setEditId(null);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(ev: VaishnavaEvent) {
    setForm({
      eventDate:          ev.eventDate,
      eventName:          ev.eventName,
      description:        ev.description ?? "",
      tithi:              ev.tithi ?? "",
      fastingUpto:        ev.fastingUpto,
      suggestedVideoId:   ev.suggestedVideoId,
      suggestedVideoTitle: ev.suggestedVideoTitle,
    });
    setLectureSearch(ev.suggestedVideoTitle ?? "");
    setEditId(ev.id);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    if (!form.eventDate || !form.eventName.trim()) {
      setError("Date and Event Name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: VaishnavaEventRequest = {
        ...form,
        description:         form.description || undefined,
        tithi:               form.tithi || undefined,
        suggestedVideoId:    form.suggestedVideoId || undefined,
        suggestedVideoTitle: form.suggestedVideoTitle || undefined,
      };
      if (editId !== null) {
        await updateCalendarEvent(editId, payload);
        setSuccess("Event updated.");
      } else {
        await createCalendarEvent(payload);
        setSuccess("Event created.");
      }
      setShowForm(false);
      setEditId(null);
      fetchEvents();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to save.");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this event?")) return;
    try {
      await deleteCalendarEvent(id);
      setSuccess("Event deleted.");
      fetchEvents();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to delete.");
    }
  }

  async function handleIcalImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importIcalEvents(file);
      setSuccess(`Imported ${result.imported} event${result.imported !== 1 ? "s" : ""} from .ical file.`);
      fetchEvents();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Import failed.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const monthLabel = `${["January","February","March","April","May","June","July","August","September","October","November","December"][viewMonth]} ${viewYear}`;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-orange-400 text-xl">🪔</span>
          <h2 className="text-white font-bold text-lg">Vaishnava Calendar</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {importing ? (
              <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            )}
            Import .ical
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,.ical"
            className="hidden"
            onChange={handleIcalImport}
          />
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Event
          </button>
        </div>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      {/* Event form (inline sheet) */}
      {showForm && (
        <div className="mb-6 bg-gray-900/80 border border-gray-700 rounded-2xl px-5 py-5">
          <h3 className="text-white font-semibold text-sm mb-4">{editId !== null ? "Edit Event" : "New Event"}</h3>

          <div className="space-y-3">
            {/* Date */}
            <div>
              <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Date *</label>
              <input
                type="date"
                value={form.eventDate}
                onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Event Name */}
            <div>
              <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Event Name *</label>
              <input
                type="text"
                value={form.eventName}
                onChange={e => setForm(f => ({ ...f, eventName: e.target.value }))}
                placeholder="e.g. Ekādaśī, Janmāshtamī…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Tithi */}
            <div>
              <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Tithi</label>
              <input
                type="text"
                value={form.tithi}
                onChange={e => setForm(f => ({ ...f, tithi: e.target.value }))}
                placeholder="e.g. Ekādaśī, Dvādaśī…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Fasting upto */}
            <div>
              <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Fasting upto</label>
              <select
                value={form.fastingUpto ?? ""}
                onChange={e => setForm(f => ({ ...f, fastingUpto: (e.target.value as FastingUpto) || undefined }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">— None —</option>
                {FASTING_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Suggested Lecture */}
            <div className="relative">
              <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Suggested Lecture</label>
              {form.suggestedVideoId ? (
                <div className="flex items-center gap-2 bg-gray-800 border border-orange-500/40 rounded-xl px-3 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-orange-400 flex-shrink-0">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                  <span className="text-white text-sm flex-1 truncate">{form.suggestedVideoTitle}</span>
                  <button
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, suggestedVideoId: undefined, suggestedVideoTitle: undefined })); setLectureSearch(""); }}
                    className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={lectureSearch}
                    onChange={e => { setLectureSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder="Search lecture by title…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                  {showDropdown && filteredVideos.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
                      {filteredVideos.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onMouseDown={() => {
                            setForm(f => ({ ...f, suggestedVideoId: v.id, suggestedVideoTitle: v.title }));
                            setLectureSearch(v.title);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-800 flex items-center gap-2 border-b border-gray-800 last:border-0"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-orange-400 flex-shrink-0">
                            <path d="M8 5.14v14l11-7-11-7z" />
                          </svg>
                          <span className="truncate">{v.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Optional details about the event…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { setShowForm(false); setEditId(null); }}
              className="flex-1 py-2 rounded-xl bg-gray-800 text-gray-400 text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editId !== null ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Month nav + events list */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goPrev} className="p-1.5 rounded-xl text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <p className="text-gray-300 font-semibold text-sm">{monthLabel}</p>
        <button onClick={goNext} className="p-1.5 rounded-xl text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-10">No events this month. Click "New Event" to add one.</p>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-orange-400 text-[11px] font-semibold">
                      {new Date(ev.eventDate + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    {ev.fastingUpto && (
                      <span className="text-[10px] bg-orange-500/15 text-orange-300 px-1.5 py-0.5 rounded-full font-medium">
                        Fast → {FASTING_UPTO_LABELS[ev.fastingUpto]}
                      </span>
                    )}
                  </div>
                  <p className="text-white font-semibold text-sm leading-snug">{ev.eventName}</p>
                  {ev.tithi && <p className="text-amber-400/70 text-[11px] mt-0.5">🌙 {ev.tithi}</p>}
                  {ev.suggestedVideoTitle && (
                    <p className="text-orange-400/70 text-[11px] mt-0.5 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M8 5.14v14l11-7-11-7z"/></svg>
                      {ev.suggestedVideoTitle}
                    </p>
                  )}
                  {ev.description && <p className="text-gray-500 text-[12px] mt-1 leading-relaxed line-clamp-2">{ev.description}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(ev)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
