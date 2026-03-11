"use client";

import { useEffect, useRef, useMemo, useState } from "react";

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
  onSeek?: (seconds: number) => void;
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
  onSeek,
}: Props) {
  const activeRef    = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBackBtn, setShowBackBtn] = useState(false);

  // True while a programmatic scrollIntoView is in flight — prevents it from
  // being mistaken for a user scroll.
  const programmaticScrollRef = useRef(false);
  const programmaticTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // True once the user has manually scrolled away — suppresses programmatic
  // scrollIntoView so the view stays where the user placed it. Resets when the
  // user taps "back to current" or clicks a transcript line to seek.
  const userScrolledRef = useRef(false);

  /** Call before any scrollIntoView so the scroll event doesn't flip userScrolledRef. */
  const markProgrammaticScroll = () => {
    programmaticScrollRef.current = true;
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
    programmaticTimerRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 1200);
  };

  // Parse SRT entries, fall back to plain transcript split by newlines
  const entries = useMemo(() => {
    if (transcriptSrt) {
      return parseSrt(transcriptSrt);
    }
    if (transcript) {
      // If the plain transcript field actually contains SRT content, parse it properly
      if (transcript.includes("-->")) {
        return parseSrt(transcript);
      }
      // True plain text — no timing
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

  // Auto-scroll to active entry only when autoScroll is on AND the user hasn't
  // manually scrolled away.
  useEffect(() => {
    if (autoScroll && hasTiming && !search && !userScrolledRef.current) {
      markProgrammaticScroll();
      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, hasTiming, search, autoScroll]);

  // Detect when the active cue scrolls out of view → show "back to current" button
  useEffect(() => {
    if (!hasTiming || activeIndex < 0 || search) {
      setShowBackBtn(false);
      return;
    }
    const el = activeRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    // IntersectionObserver: only drives the pin button visibility
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowBackBtn(!entry.isIntersecting);
      },
      { root: container, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeIndex, hasTiming, search]);

  // Detect genuine user scroll → mark that the user has scrolled away so we
  // stop chasing them with scrollIntoView (highlight still follows the audio).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (programmaticScrollRef.current) return; // ignore auto-scrolls
      if (!hasTiming || search) return;
      userScrolledRef.current = true;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTiming, search]);

  const scrollToActive = () => {
    userScrolledRef.current = false; // resume auto-scroll
    markProgrammaticScroll();
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        No transcript available
      </div>
    );
  }

  return (
    // Outer wrapper: relative + non-scrolling, so the button floats in the corner
    <div className="flex-1 relative overflow-hidden">
      {/* Scrollable transcript */}
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto px-5 py-2">
        {/* Start time indicator — removed per user request */}

        {filtered.map((entry) => {
          const isActive = hasTiming && !search && entry.originalIndex === activeIndex;
          const seekable = hasTiming && entry.startMs >= 0 && !!onSeek;
          return (
            <p
              key={entry.index}
              ref={isActive ? activeRef : undefined}
              onClick={seekable ? () => {
                userScrolledRef.current = false; // resume auto-scroll to clicked position
                onSeek!(entry.startMs / 1000);
              } : undefined}
              className={`text-lg leading-relaxed mb-5 transition-colors duration-300 ${
                seekable ? "cursor-pointer select-none" : ""
              } ${
                !autoScroll
                  ? "text-gray-300"
                  : isActive
                  ? "text-white font-medium"
                  : hasTiming && !search
                  ? entry.originalIndex < activeIndex
                    ? "text-gray-600 hover:text-gray-400"
                    : "text-gray-500 hover:text-gray-300"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              {entry.text}
            </p>
          );
        })}
      </div>

      {/* Floating "back to current" button — visible when user scrolled away */}
      {showBackBtn && (
        <button
          onClick={scrollToActive}
          title="Back to current position"
          className="absolute bottom-5 right-4 z-10 w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-lg shadow-orange-900/40 flex items-center justify-center transition-all"
        >
          {/* Locate / sync icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
            <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}
