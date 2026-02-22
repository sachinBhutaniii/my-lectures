"use client";

import { useEffect, useRef, useMemo } from "react";

interface SrtEntry {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

interface Props {
  transcriptSrt?: string;
  transcript?: string;
  search: string;
  currentTime: number; // seconds from audio player
  startTime?: number;  // recording start offset in seconds
  autoScroll: boolean;
}

/**
 * Parse an SRT timestamp like "01:02:03,456" or "02:03,456" into milliseconds.
 */
function parseSrtTime(ts: string): number {
  ts = ts.trim();
  const parts = ts.split(",");
  const ms = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  const timeParts = parts[0].split(":").map(Number);

  let hours = 0, minutes = 0, seconds = 0;
  if (timeParts.length === 3) {
    [hours, minutes, seconds] = timeParts;
  } else if (timeParts.length === 2) {
    [minutes, seconds] = timeParts;
  }

  return (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
}

/**
 * Parse full SRT content into structured entries.
 */
function parseSrt(srt: string): SrtEntry[] {
  if (!srt) return [];
  const blocks = srt.trim().split(/\n\s*\n/);
  const entries: SrtEntry[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    const timeLine = lines[1];
    const arrowIdx = timeLine.indexOf("-->");
    if (arrowIdx === -1) continue;

    const startMs = parseSrtTime(timeLine.slice(0, arrowIdx));
    const endMs = parseSrtTime(timeLine.slice(arrowIdx + 3));
    const text = lines.slice(2).join(" ").trim();

    if (text) {
      entries.push({ index, startMs, endMs, text });
    }
  }

  return entries;
}

function formatStartTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TranscriptView({
  transcriptSrt,
  transcript,
  search,
  currentTime,
  startTime,
  autoScroll,
}: Props) {
  const activeRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse SRT entries, fall back to plain transcript split by newlines
  const entries = useMemo(() => {
    if (transcriptSrt) {
      return parseSrt(transcriptSrt);
    }
    // Fallback: plain transcript, no timing
    if (transcript) {
      return transcript
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text, i) => ({
          index: i + 1,
          startMs: -1,
          endMs: -1,
          text,
        }));
    }
    return [];
  }, [transcriptSrt, transcript]);

  const hasTiming = entries.length > 0 && entries[0].startMs >= 0;
  const currentMs = currentTime * 1000;

  // Find the active entry index based on current audio time
  const activeIndex = useMemo(() => {
    if (!hasTiming) return -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (currentMs >= entries[i].startMs) return i;
    }
    return -1;
  }, [entries, currentMs, hasTiming]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search) return entries.map((e, i) => ({ ...e, originalIndex: i }));
    return entries
      .map((e, i) => ({ ...e, originalIndex: i }))
      .filter((e) => e.text.toLowerCase().includes(search.toLowerCase()));
  }, [entries, search]);

  // Auto-scroll to active entry only when autoScroll is on
  useEffect(() => {
    if (autoScroll && hasTiming && !search) {
      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex, hasTiming, search, autoScroll]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        No transcript available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-2 relative">
      {/* Start time indicator */}
      {startTime != null && startTime > 0 && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-orange-400 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-orange-400 text-sm font-medium">
            Transcription starts at {formatStartTime(startTime)}
          </span>
        </div>
      )}

      {filtered.map((entry) => {
        const isActive = hasTiming && !search && entry.originalIndex === activeIndex;
        return (
          <p
            key={entry.index}
            ref={isActive ? activeRef : undefined}
            className={`text-lg leading-relaxed mb-5 transition-colors duration-300 ${
              !autoScroll
                ? "text-gray-300"
                : isActive
                ? "text-white font-medium"
                : hasTiming && !search
                ? entry.originalIndex < activeIndex
                  ? "text-gray-600"
                  : "text-gray-500"
                : "text-gray-300"
            }`}
          >
            {entry.text}
          </p>
        );
      })}
    </div>
  );
}
