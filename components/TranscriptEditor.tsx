"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type React from "react";
import {
  SrtCue, CueDiff,
  parseSrt, serializeSrt, diffCues, timeToMs, formatTime,
} from "@/lib/srtUtils";
import {
  TranscriptEditorData,
  saveTranscriptDraft,
  submitTranscriptReview,
  publishTranscript,
  regenerateTranscriptRange,
  redistributeTimestamps,
  SrtCueDtoItem,
} from "@/services/video.service";
import { useStreak } from "@/hooks/useStreak";

type EditorMode = "l1" | "l2" | "admin";

interface Props {
  data: TranscriptEditorData;
  mode: EditorMode;
  level?: 1 | 2;
  onBack: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Convert plain transcript text to basic SRT cues (~20 words each, 30s intervals). */
function plainTextToSrtCues(text: string): SrtCue[] {
  if (!text?.trim()) return [];

  // Split into ~20-word chunks
  const WORDS_PER_CUE = 20;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CUE) {
    parts.push(words.slice(i, i + WORDS_PER_CUE).join(" "));
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmtMs = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = ms % 1000;
    return `${pad(h)}:${pad(m)}:${pad(s)},${String(mil).padStart(3, "0")}`;
  };

  const chunkDurationMs = 30000; // 30s per cue (placeholder)
  return parts.map((t, i) => ({
    id: i + 1,
    startTime: fmtMs(i * chunkDurationMs),
    endTime: fmtMs((i + 1) * chunkDurationMs),
    startMs: i * chunkDurationMs,
    endMs: (i + 1) * chunkDurationMs,
    text: t,
  }));
}

/** Format milliseconds to SRT timestamp string. */
function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mil = ms % 1000;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(mil).padStart(3, "0")}`;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TranscriptEditor({ data, mode, level = 1, onBack }: Props) {
  // Working cues
  const [cues, setCues] = useState<SrtCue[]>([]);
  const [l1Diff, setL1Diff] = useState<Map<number, CueDiff>>(new Map());
  const [l2Diff, setL2Diff] = useState<Map<number, CueDiff>>(new Map());
  const [acceptedL1Ids, setAcceptedL1Ids] = useState<Set<number>>(new Set());
  const [preAcceptAllSnapshot, setPreAcceptAllSnapshot] = useState<{ cues: SrtCue[]; acceptedIds: Set<number> } | null>(null);
  const [adminAcceptedL1Ids, setAdminAcceptedL1Ids] = useState<Set<number>>(new Set());
  const [adminRejectedL1Ids, setAdminRejectedL1Ids] = useState<Set<number>>(new Set());
  const [adminAcceptedL2Ids, setAdminAcceptedL2Ids] = useState<Set<number>>(new Set());
  const [adminRejectedL2Ids, setAdminRejectedL2Ids] = useState<Set<number>>(new Set());

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ text: "", startTime: "", endTime: "" });

  // Audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { addListeningTime } = useStreak();
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => addListeningTime(1), 1000);
    return () => clearInterval(id);
  }, [isPlaying, addListeningTime]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [activeCueId, setActiveCueId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [autoSelectCount, setAutoSelectCount] = useState(20);
  const [regenerating, setRegenerating] = useState(false);
  const [isRedistributing, setIsRedistributing] = useState(false);
  const [selectAction, setSelectAction] = useState<"text" | "timestamps">("text");
  const [tsRangeStart, setTsRangeStart] = useState("");
  const [tsRangeEnd, setTsRangeEnd] = useState("");
  const [tsEditCue, setTsEditCue] = useState<SrtCue | null>(null);
  const dragStartId = useRef<number | null>(null);
  const isDragging = useRef(false);

  // Save/submit state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [publishDone, setPublishDone] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origCuesRef = useRef<SrtCue[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Preview-loop refs (seek to cue + loop 2× on edit open)
  const wasPlayingRef = useRef(false);
  const previewCueRef = useRef<{ startMs: number; endMs: number } | null>(null);
  const previewLoopCountRef = useRef(0);

  // Fullscreen (triple-tap to toggle)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsHint, setFsHint] = useState<"entered" | "exited" | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const fsHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rawTranscriptUsed, setRawTranscriptUsed] = useState(false);
  const [truncatedDraftRecovered, setTruncatedDraftRecovered] = useState(false);

  // ── Initialise cues ──────────────────────────────────────────────────────────
  useEffect(() => {
    let orig = parseSrt(data.originalSrt ?? "");
    let l1 = parseSrt(data.level1Srt ?? "");
    let l2 = parseSrt(data.level2Srt ?? "");

    // Fallback: if SRT data is missing or has ≤1 cue, generate from plain transcript.
    // Apply to all levels that are also incomplete so L1/L2 mode uses the generated cues.
    if (orig.length <= 1 && data.rawTranscript?.trim()) {
      const generated = plainTextToSrtCues(data.rawTranscript);
      orig = generated;
      if (l1.length <= 1) l1 = generated;
      if (l2.length <= 1) l2 = generated;
      setRawTranscriptUsed(true);
    } else {
      setRawTranscriptUsed(false);
    }

    origCuesRef.current = orig;

    if (mode === "l1") {
      // Detect a truncated draft: if L1 ends significantly before the original audio,
      // the saved draft was incomplete — append the missing original cues so the proofreader
      // can see and review the full transcript.
      if (l1.length > 0 && orig.length > 0) {
        const l1LastMs = l1[l1.length - 1].endMs;
        const origLastMs = orig[orig.length - 1].endMs;
        if (origLastMs > 0 && l1LastMs < origLastMs * 0.95) {
          const remaining = orig
            .filter((c) => c.startMs > l1LastMs)
            .map((c, i) => ({ ...c, id: l1.length + i + 1 }));
          setCues(remaining.length > 0 ? [...l1, ...remaining] : l1);
          setTruncatedDraftRecovered(remaining.length > 0);
        } else {
          setCues(l1);
          setTruncatedDraftRecovered(false);
        }
      } else {
        setCues(l1.length > 0 ? l1 : orig);
        setTruncatedDraftRecovered(false);
      }
    } else if (mode === "l2") {
      // L2 starts from L1's approved version (falls back to orig if L1 is empty)
      setCues(l2.length > 0 ? l2 : l1.length > 0 ? l1 : orig);
      if (l1.length > 0) setL1Diff(diffCues(orig, l1));
    } else {
      // Admin: start from best available version
      const best = l2.length > 0 ? l2 : l1.length > 0 ? l1 : orig;
      setCues(best);
      if (l1.length > 0) setL1Diff(diffCues(orig, l1));
      if (l2.length > 0 && l1.length > 0) setL2Diff(diffCues(l1, l2));
      else if (l2.length > 0) setL2Diff(diffCues(orig, l2));
    }
  }, [data, mode]);

  // ── Audio events ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      // Preview loop: when current time passes cue end, loop or stop
      const preview = previewCueRef.current;
      if (preview && audio.currentTime >= preview.endMs / 1000) {
        if (previewLoopCountRef.current < 1) {
          // First loop done — play once more
          previewLoopCountRef.current++;
          audio.currentTime = preview.startMs / 1000;
        } else {
          // Both loops done — stop and clear preview
          previewCueRef.current = null;
          audio.pause();
          setIsPlaying(false);
        }
      }
    };
    const onDur = () => setDuration(audio.duration);
    const onEnd = () => { previewCueRef.current = null; setIsPlaying(false); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  // ── Regressed cue detection ──────────────────────────────────────────────────
  // A cue is "regressed" if its startMs is earlier than the highest endMs seen
  // so far — meaning timestamps went backwards (AI hallucination artifact).
  const regressedIds = useMemo(() => {
    const ids = new Set<number>();
    let highwater = 0;
    for (const cue of cues) {
      if (cue.startMs < highwater) ids.add(cue.id);
      if (cue.endMs > highwater) highwater = cue.endMs;
    }
    return ids;
  }, [cues]);

  // ── Active cue + auto-scroll ─────────────────────────────────────────────────
  useEffect(() => {
    const ms = currentTime * 1000;
    const active = cues.find((c) => !regressedIds.has(c.id) && ms >= c.startMs && ms < c.endMs);
    if (active && active.id !== activeCueId) {
      setActiveCueId(active.id);
      if (autoScroll && editingId === null) {
        document
          .querySelector(`[data-cue="${active.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentTime, cues, activeCueId, autoScroll, editingId, regressedIds]);

  // ── Auto-save (L1 / L2 only) ─────────────────────────────────────────────────
  useEffect(() => {
    if (cues.length === 0) return;
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const saveLevel: 1 | 2 = mode === "admin" ? 2 : level as 1 | 2;
        await saveTranscriptDraft(data.id, saveLevel, serializeSrt(cues));
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch {
        setSaveStatus("error");
      }
    }, 3000);
    return () => { if (saveTimer.current !== null) clearTimeout(saveTimer.current); };
  }, [cues, data.id, level, mode]);

  // ── L1 mode: live track-changes diff ─────────────────────────────────────────
  useEffect(() => {
    if (mode !== "l1" || origCuesRef.current.length === 0 || cues.length === 0) return;
    setL1Diff(diffCues(origCuesRef.current, cues));
  }, [cues, mode]);

  // ── Fullscreen ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const inFS = !!(document.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(inFS);
      if (fsHintTimerRef.current !== null) clearTimeout(fsHintTimerRef.current);
      setFsHint(inFS ? "entered" : "exited");
      fsHintTimerRef.current = setTimeout(() => setFsHint(null), 1800);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = () => {
    type FSDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    type FSEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const doc = document as FSDoc;
    const el = document.documentElement as FSEl;
    const inFS = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    if (inFS) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };

  const handleTripleTap = (e: React.TouchEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (["INPUT", "TEXTAREA", "BUTTON", "A", "SELECT"].includes(tag)) return;
    const now = Date.now();
    const recent = tapTimesRef.current.filter((t) => now - t < 600);
    recent.push(now);
    tapTimesRef.current = recent;
    if (recent.length >= 3) {
      tapTimesRef.current = [];
      toggleFullscreen();
    }
  };

  // ── Audio controls ───────────────────────────────────────────────────────────
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  };
  const skip = (sec: number) => {
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + sec);
  };
  const setPlaybackSpeed = (s: number) => {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };
  const seekTo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  // ── Cue editing ──────────────────────────────────────────────────────────────
  const startEdit = (cue: SrtCue) => {
    setEditingId(cue.id);
    setDraft({ text: cue.text, startTime: cue.startTime, endTime: cue.endTime });

    const audio = audioRef.current;
    if (audio && data.audioUrl) {
      wasPlayingRef.current = !audio.paused;
      audio.pause();
      setIsPlaying(false);
      // Seek to cue and loop 2×
      previewCueRef.current = { startMs: cue.startMs, endMs: cue.endMs };
      previewLoopCountRef.current = 0;
      audio.currentTime = cue.startMs / 1000;
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };
  const cancelEdit = () => {
    previewCueRef.current = null;
    setEditingId(null);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
      if (wasPlayingRef.current) {
        audio.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };
  const saveEdit = useCallback(() => {
    if (editingId === null) return;
    previewCueRef.current = null;
    setCues((prev) =>
      prev.map((c) =>
        c.id === editingId
          ? {
              ...c,
              text: draft.text,
              startTime: draft.startTime,
              endTime: draft.endTime,
              startMs: timeToMs(draft.startTime),
              endMs: timeToMs(draft.endTime),
            }
          : c
      )
    );
    setEditingId(null);
    const audio = audioRef.current;
    if (audio && wasPlayingRef.current) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [editingId, draft]);

  // ── Delete / Insert cue ──────────────────────────────────────────────────────
  const deleteCue = useCallback((id: number) => {
    setCues((prev) => prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, id: i + 1 })));
  }, []);

  const insertCueAfter = useCallback((afterId: number) => {
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === afterId);
      if (idx === -1) return prev;
      const cur = prev[idx];
      const nxt = prev[idx + 1];
      const newStartMs = cur.endMs;
      const newEndMs = nxt ? Math.max(cur.endMs + 1000, Math.round((cur.endMs + nxt.startMs) / 2)) : cur.endMs + 5000;
      const newCue: SrtCue = {
        id: 0,
        startTime: msToSrtTime(newStartMs),
        endTime: msToSrtTime(newEndMs),
        startMs: newStartMs,
        endMs: newEndMs,
        text: "",
      };
      return [
        ...prev.slice(0, idx + 1),
        newCue,
        ...prev.slice(idx + 1),
      ].map((c, i) => ({ ...c, id: i + 1 }));
    });
  }, []);

  // ── Timestamp editor ─────────────────────────────────────────────────────────
  const openTsEditor = useCallback((cue: SrtCue) => {
    audioRef.current?.pause();
    setIsPlaying(false);
    previewCueRef.current = null;
    setTsEditCue(cue);
  }, []);

  const closeTsEditor = useCallback(() => {
    previewCueRef.current = null;
    audioRef.current?.pause();
    setIsPlaying(false);
    setTsEditCue(null);
  }, []);

  const saveTsEdit = useCallback((cueId: number, startMs: number, endMs: number) => {
    setCues((prev) =>
      prev.map((c) =>
        c.id === cueId
          ? { ...c, startMs, endMs, startTime: msToSrtTime(startMs), endTime: msToSrtTime(endMs) }
          : c
      )
    );
    previewCueRef.current = null;
    audioRef.current?.pause();
    setIsPlaying(false);
    setTsEditCue(null);
  }, []);

  const mergeCueWithNext = useCallback((id: number) => {
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const cur = prev[idx];
      const nxt = prev[idx + 1];
      const merged: SrtCue = {
        id: cur.id,
        startMs: cur.startMs,
        endMs: nxt.endMs,
        startTime: cur.startTime,
        endTime: nxt.endTime,
        text: cur.text.trim() + " " + nxt.text.trim(),
      };
      return [...prev.slice(0, idx), merged, ...prev.slice(idx + 2)].map((c, i) => ({ ...c, id: i + 1 }));
    });
    previewCueRef.current = null;
    audioRef.current?.pause();
    setIsPlaying(false);
    setTsEditCue(null);
  }, []);

  // ── L2: accept L1 changes ────────────────────────────────────────────────────
  const acceptL1Change = (cueId: number) => {
    const diff = l1Diff.get(cueId);
    if (!diff) return;
    setCues((prev) =>
      prev.map((c) =>
        c.id === cueId
          ? { ...c, text: diff.newText, startTime: diff.newStart, endTime: diff.newEnd, startMs: timeToMs(diff.newStart), endMs: timeToMs(diff.newEnd) }
          : c
      )
    );
    setAcceptedL1Ids((prev) => new Set([...prev, cueId]));
    setPreAcceptAllSnapshot(null); // individual accept invalidates the bulk undo
  };
  const acceptAllL1 = () => {
    setPreAcceptAllSnapshot({ cues: [...cues], acceptedIds: new Set(acceptedL1Ids) });
    setCues((prev) =>
      prev.map((c) => {
        const diff = l1Diff.get(c.id);
        if (!diff) return c;
        return { ...c, text: diff.newText, startTime: diff.newStart, endTime: diff.newEnd, startMs: timeToMs(diff.newStart), endMs: timeToMs(diff.newEnd) };
      })
    );
    setAcceptedL1Ids(new Set(l1Diff.keys()));
  };
  const undoAcceptAll = () => {
    if (!preAcceptAllSnapshot) return;
    setCues(preAcceptAllSnapshot.cues);
    setAcceptedL1Ids(preAcceptAllSnapshot.acceptedIds);
    setPreAcceptAllSnapshot(null);
  };

  // ── Admin: per-cue accept/reject for L1 and L2 changes ───────────────────────
  const adminAcceptL1 = (cueId: number) => {
    const diff = l1Diff.get(cueId);
    if (!diff) return;
    setCues((prev) => prev.map((c) => c.id === cueId
      ? { ...c, text: diff.newText, startTime: diff.newStart, endTime: diff.newEnd, startMs: timeToMs(diff.newStart), endMs: timeToMs(diff.newEnd) }
      : c
    ));
    setAdminAcceptedL1Ids((prev) => new Set([...prev, cueId]));
    setAdminRejectedL1Ids((prev) => { const s = new Set(prev); s.delete(cueId); return s; });
  };
  const adminRejectL1 = (cueId: number) => {
    const diff = l1Diff.get(cueId);
    if (!diff) return;
    setCues((prev) => prev.map((c) => c.id === cueId
      ? { ...c, text: diff.origText, startTime: diff.origStart, endTime: diff.origEnd, startMs: timeToMs(diff.origStart), endMs: timeToMs(diff.origEnd) }
      : c
    ));
    setAdminRejectedL1Ids((prev) => new Set([...prev, cueId]));
    setAdminAcceptedL1Ids((prev) => { const s = new Set(prev); s.delete(cueId); return s; });
  };
  const adminAcceptL2 = (cueId: number) => {
    setAdminAcceptedL2Ids((prev) => new Set([...prev, cueId]));
    setAdminRejectedL2Ids((prev) => { const s = new Set(prev); s.delete(cueId); return s; });
  };
  const adminRejectL2 = (cueId: number) => {
    const diff = l2Diff.get(cueId);
    if (!diff) return;
    setCues((prev) => prev.map((c) => c.id === cueId
      ? { ...c, text: diff.origText, startTime: diff.origStart, endTime: diff.origEnd, startMs: timeToMs(diff.origStart), endMs: timeToMs(diff.origEnd) }
      : c
    ));
    setAdminRejectedL2Ids((prev) => new Set([...prev, cueId]));
    setAdminAcceptedL2Ids((prev) => { const s = new Set(prev); s.delete(cueId); return s; });
  };
  const adminAcceptAllL1 = () => {
    setCues((prev) => prev.map((c) => {
      const diff = l1Diff.get(c.id);
      if (!diff) return c;
      return { ...c, text: diff.newText, startTime: diff.newStart, endTime: diff.newEnd, startMs: timeToMs(diff.newStart), endMs: timeToMs(diff.newEnd) };
    }));
    setAdminAcceptedL1Ids(new Set(l1Diff.keys()));
    setAdminRejectedL1Ids(new Set());
  };
  const adminRejectAllL1 = () => {
    setCues((prev) => prev.map((c) => {
      const diff = l1Diff.get(c.id);
      if (!diff) return c;
      return { ...c, text: diff.origText, startTime: diff.origStart, endTime: diff.origEnd, startMs: timeToMs(diff.origStart), endMs: timeToMs(diff.origEnd) };
    }));
    setAdminRejectedL1Ids(new Set(l1Diff.keys()));
    setAdminAcceptedL1Ids(new Set());
  };
  const adminAcceptAllL2 = () => {
    setAdminAcceptedL2Ids(new Set(l2Diff.keys()));
    setAdminRejectedL2Ids(new Set());
  };
  const adminRejectAllL2 = () => {
    setCues((prev) => prev.map((c) => {
      const diff = l2Diff.get(c.id);
      if (!diff) return c;
      return { ...c, text: diff.origText, startTime: diff.origStart, endTime: diff.origEnd, startMs: timeToMs(diff.origStart), endMs: timeToMs(diff.origEnd) };
    }));
    setAdminRejectedL2Ids(new Set(l2Diff.keys()));
    setAdminAcceptedL2Ids(new Set());
  };

  // ── Submit review ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitTranscriptReview(data.id, level as 1 | 2, serializeSrt(cues));
      setSubmitted(true);
    } catch {
      alert("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Publish (admin) ──────────────────────────────────────────────────────────
  const handlePublish = async () => {
    setSubmitting(true);
    try {
      await publishTranscript(data.id, serializeSrt(cues));
      setPublishDone(true);
      setPublishConfirm(false);
    } catch {
      alert("Failed to publish. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Select mode helpers ──────────────────────────────────────────────────────
  const selectRange = useCallback((fromId: number, toId: number) => {
    const fromIdx = cues.findIndex((c) => c.id === fromId);
    const toIdx = cues.findIndex((c) => c.id === toId);
    const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    setSelectedIds(new Set(cues.slice(lo, hi + 1).map((c) => c.id)));
  }, [cues]);

  const handleRegenerate = async () => {
    const selectedCues = cues.filter((c) => selectedIds.has(c.id));
    if (selectedCues.length === 0) return;
    const startSec = Math.floor(Math.min(...selectedCues.map((c) => c.startMs)) / 1000);
    const endSec = Math.ceil(Math.max(...selectedCues.map((c) => c.endMs)) / 1000) + 2;
    setRegenerating(true);
    try {
      const { cues: rawCues } = await regenerateTranscriptRange(data.id, startSec, endSec);
      const insertionPoint = cues.findIndex((c) => selectedIds.has(c.id));
      const nonSelected = cues.filter((c) => !selectedIds.has(c.id));
      const insertInNonSelected = cues.slice(0, insertionPoint).filter((c) => !selectedIds.has(c.id)).length;
      const newSrtCues = rawCues.map((c: SrtCueDtoItem) => ({
        id: 0,
        startTime: c.startTime,
        endTime: c.endTime,
        startMs: timeToMs(c.startTime),
        endMs: timeToMs(c.endTime),
        text: c.text,
      }));
      const merged = [
        ...nonSelected.slice(0, insertInNonSelected),
        ...newSrtCues,
        ...nonSelected.slice(insertInNonSelected),
      ].map((c, i) => ({ ...c, id: i + 1 }));
      setCues(merged);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch {
      alert("Regeneration failed. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  // ── Pre-fill timestamp inputs when selection changes ─────────────────────────
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const selected = cues.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;
    setTsRangeStart(selected[0].startTime);
    setTsRangeEnd(selected[selected.length - 1].endTime);
  }, [selectedIds, cues]);

  // ── Redistribute timestamps via Gemini audio analysis ──────────────────────────
  const handleRedistributeTimestamps = async () => {
    const fromMs = timeToMs(tsRangeStart);
    const toMs = timeToMs(tsRangeEnd);
    if (toMs <= fromMs) {
      alert("End time must be after start time.");
      return;
    }
    const selected = cues.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;

    setIsRedistributing(true);
    try {
      const updated = await redistributeTimestamps(
        data.id,
        fromMs / 1000,
        toMs / 1000,
        selected.map((c) => ({ id: c.id, text: c.text }))
      );
      const updatedMap = new Map(updated.map((u) => [u.id, u]));
      setCues((prev) => prev.map((c) => {
        const u = updatedMap.get(c.id);
        return u ? { ...c, startTime: u.startTime, endTime: u.endTime, startMs: u.startMs, endMs: u.endMs } : c;
      }));
      setSelectedIds(new Set());
      setSelectMode(false);
      setSelectAction("text");
    } catch {
      alert("Failed to redistribute timestamps. Please try again.");
    } finally {
      setIsRedistributing(false);
    }
  };

  const pendingL1Changes = l1Diff.size - acceptedL1Ids.size;
  const allAccepted = l1Diff.size > 0 && pendingL1Changes === 0;
  const hasL2 = data.level2Srt != null;

  if (submitted) return <SuccessScreen mode={mode} level={level} onBack={onBack} />;
  if (publishDone) return <PublishedScreen onBack={onBack} />;

  const noSrt = cues.length === 0;

  return (
    <div className="h-dvh bg-[#0a0a0a] flex flex-col overflow-hidden" onTouchEnd={handleTripleTap}>
      {/* Hidden audio */}
      {data.audioUrl && <audio ref={audioRef} src={data.audioUrl} preload="metadata" />}

      {/* Fullscreen hint toast */}
      {fsHint && (
        <div className="fixed inset-x-0 top-16 z-[100] flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/95 border border-gray-700 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            {fsHint === "entered" ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400">
                  <path fillRule="evenodd" d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.75a.75.75 0 0 1 0 1.5H2.5v3.75a.75.75 0 0 1-1.5 0V3.5Zm13.75-.75a.75.75 0 0 1 .75.75V7.25a.75.75 0 0 1-1.5 0V3.5h-3.75a.75.75 0 0 1 0-1.5h3.75A1.5 1.5 0 0 1 17 3.5ZM.75 13.25a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5H2.5A1.5 1.5 0 0 1 1 17.75V14a.75.75 0 0 1 .75-.75Zm18.5 0A.75.75 0 0 1 20 14v3.75A1.5 1.5 0 0 1 18.5 19H14.75a.75.75 0 0 1 0-1.5H18.5V14a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-gray-200">Fullscreen — triple tap to exit</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                  <path fillRule="evenodd" d="M4.5 4.5a.75.75 0 0 0-1.06 1.06L6.19 8.31H2.75a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 .75-.75v-5a.75.75 0 0 0-1.5 0v3.44L4.5 4.5Zm11 11a.75.75 0 0 0 1.06-1.06l-2.75-2.75h3.44a.75.75 0 0 0 0-1.5h-5a.75.75 0 0 0-.75.75v5a.75.75 0 0 0 1.5 0v-3.44l2.75 2.75-.25-.75Z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-gray-400">Exited fullscreen</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-4 pb-3 border-b border-gray-800 flex-shrink-0 ${isFullscreen ? "pt-3" : "pt-12"}`}>
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{data.videoTitle}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">{data.localeName}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
              mode === "l1" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" :
              mode === "l2" ? "bg-purple-500/10 border-purple-500/30 text-purple-400" :
              "bg-amber-500/10 border-amber-400/30 text-amber-300"
            }`}>
              {mode === "l1" ? "Level 1 Review" : mode === "l2" ? "Level 2 Review" : "Admin Review"}
            </span>
            {saveStatus === "saving" && <span className="text-[10px] text-gray-500 animate-pulse">Saving…</span>}
            {saveStatus === "saved" && <span className="text-[10px] text-green-500">Saved ✓</span>}
            {saveStatus === "error" && <span className="text-[10px] text-red-400">Save failed</span>}
          </div>
        </div>
        {/* Actions */}
        {mode !== "admin" && (
          <button
            onClick={handleSubmit}
            disabled={submitting || noSrt}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? <Spinner /> : <>Submit Review</>}
          </button>
        )}
        {mode === "admin" && (
          <button
            onClick={() => setPublishConfirm(true)}
            disabled={submitting || noSrt}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            Publish ↑
          </button>
        )}
        {/* Select mode toggle */}
        <button
          onClick={() => {
            setSelectMode((v) => !v);
            if (selectMode) setSelectedIds(new Set());
          }}
          className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            selectMode
              ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
              : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
          }`}
          title="Select cues for range regeneration"
        >
          Select
        </button>
        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          className="flex-shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen (or triple tap)"}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M4.5 4.5a.75.75 0 0 0-1.06 1.06L6.19 8.31H2.75a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 .75-.75v-5a.75.75 0 0 0-1.5 0v3.44L4.5 4.5Zm11 11a.75.75 0 0 0 1.06-1.06l-2.75-2.75h3.44a.75.75 0 0 0 0-1.5h-5a.75.75 0 0 0-.75.75v5a.75.75 0 0 0 1.5 0v-3.44l2.75 2.75Z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.75a.75.75 0 0 1 0 1.5H2.5v3.75a.75.75 0 0 1-1.5 0V3.5Zm13.75-.75a.75.75 0 0 1 .75.75V7.25a.75.75 0 0 1-1.5 0V3.5h-3.75a.75.75 0 0 1 0-1.5h3.75A1.5 1.5 0 0 1 17 3.5ZM.75 13.25a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5H2.5A1.5 1.5 0 0 1 1 17.75V14a.75.75 0 0 1 .75-.75Zm18.5 0A.75.75 0 0 1 20 14v3.75A1.5 1.5 0 0 1 18.5 19H14.75a.75.75 0 0 1 0-1.5H18.5V14a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Audio Player Bar ──────────────────────────────────────────────────── */}
      {data.audioUrl && (
        <div className="flex-shrink-0 bg-gray-950 border-b border-gray-800 px-4 py-3">
          {/* Progress bar */}
          <input
            type="range" min={0} max={duration || 0} step={0.1} value={currentTime}
            onChange={seekTo}
            className="w-full h-1 accent-blue-500 mb-2 cursor-pointer"
          />
          {/* Row 1: transport controls + time */}
          <div className="flex items-center gap-3">
            {/* Skip back */}
            <button onClick={() => skip(-10)} className="text-gray-400 hover:text-white transition-colors" title="Skip back 10s">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.629v-2.34l6.945 3.968c1.25.715 2.805-.188 2.805-1.628V8.688c0-1.44-1.555-2.342-2.805-1.628L12 11.03v-2.34c0-1.44-1.555-2.343-2.805-1.629l-7.108 4.062c-1.26.72-1.26 2.536 0 3.256l7.108 4.061Z" />
              </svg>
            </button>
            {/* Play/Pause */}
            <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors flex-shrink-0">
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7 0a.75.75 0 0 1 .75-.75H16.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            {/* Skip forward */}
            <button onClick={() => skip(10)} className="text-gray-400 hover:text-white transition-colors" title="Skip forward 10s">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v8.123c0 1.44 1.555 2.343 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L14.805 7.06C13.555 6.347 12 7.25 12 8.69v2.34L5.055 7.06Z" />
              </svg>
            </button>
            {/* Time */}
            <span className="text-xs text-gray-500 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          {/* Row 2: speed + auto-scroll */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-0.5 flex-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    speed === s
                      ? "bg-blue-500 text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors flex-shrink-0 ${
                autoScroll
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                  : "bg-gray-800 border-gray-700 text-gray-500"
              }`}
              title="Toggle auto-scroll"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
              </svg>
              {autoScroll ? "Auto" : "Manual"}
            </button>
          </div>
        </div>
      )}

      {/* ── L2: Accept All bar ────────────────────────────────────────────────── */}
      {mode === "l2" && l1Diff.size > 0 && (
        <div className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-b ${
          allAccepted
            ? "bg-green-500/5 border-green-500/20"
            : "bg-purple-500/5 border-purple-500/20"
        }`}>
          {allAccepted ? (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              All {l1Diff.size} Level-1 edit{l1Diff.size > 1 ? "s" : ""} accepted
            </p>
          ) : (
            <p className="text-xs text-purple-300">
              <span className="font-semibold">{pendingL1Changes}</span> Level-1 edit{pendingL1Changes > 1 ? "s" : ""} to review
            </p>
          )}
          <div className="flex items-center gap-2">
            {preAcceptAllSnapshot && (
              <button
                onClick={undoAcceptAll}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 transition-colors flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 0 1-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 0 1 0 10.75H10.75a.75.75 0 0 1 0-1.5h2.875a3.875 3.875 0 0 0 0-7.75H3.622l4.146 3.957a.75.75 0 0 1-1.036 1.085l-5.5-5.25a.75.75 0 0 1 0-1.085l5.5-5.25a.75.75 0 0 1 1.06.025Z" clipRule="evenodd" />
                </svg>
                Undo
              </button>
            )}
            {!allAccepted && (
              <button
                onClick={acceptAllL1}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-colors"
              >
                Accept All Changes
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Admin accept/reject bar ───────────────────────────────────────────── */}
      {mode === "admin" && (l1Diff.size > 0 || l2Diff.size > 0) && (() => {
        const l1Pending = l1Diff.size - adminAcceptedL1Ids.size - adminRejectedL1Ids.size;
        const l2Pending = l2Diff.size - adminAcceptedL2Ids.size - adminRejectedL2Ids.size;
        return (
          <div className="flex-shrink-0 flex flex-col gap-1.5 px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/15">
            {l1Diff.size > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-blue-400 font-medium">L1</span>
                  <span>{l1Pending > 0 ? `${l1Pending} pending` : "all reviewed"}</span>
                </span>
                <div className="flex gap-1.5">
                  <button onClick={adminAcceptAllL1} className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25 transition-colors">Accept All ✓</button>
                  <button onClick={adminRejectAllL1} className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-colors">Reject All ✗</button>
                </div>
              </div>
            )}
            {l2Diff.size > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                  <span className="text-purple-400 font-medium">L2</span>
                  <span>{l2Pending > 0 ? `${l2Pending} pending` : "all reviewed"}</span>
                </span>
                <div className="flex gap-1.5">
                  <button onClick={adminAcceptAllL2} className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25 transition-colors">Accept All ✓</button>
                  <button onClick={adminRejectAllL2} className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-colors">Reject All ✗</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Raw transcript fallback warning ──────────────────────────────────── */}
      {rawTranscriptUsed && (
        <div className="flex-shrink-0 flex items-start gap-2.5 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/25">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-xs font-medium text-amber-300">Timestamps not available</p>
            <p className="text-[11px] text-amber-500/80 mt-0.5">SRT data is missing or incomplete. Content loaded from plain transcript — timestamps are placeholders. Please fix timings while reviewing.</p>
          </div>
        </div>
      )}

      {/* ── Truncated draft recovery notice ──────────────────────────────────── */}
      {truncatedDraftRecovered && (
        <div className="flex-shrink-0 flex items-start gap-2.5 px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-xs font-medium text-blue-300">Partial draft detected — full transcript restored</p>
            <p className="text-[11px] text-blue-400/70 mt-0.5">The saved draft covered only part of the audio. The remaining original cues have been appended so the full transcript is available for review.</p>
          </div>
        </div>
      )}

      {/* ── Cue list ──────────────────────────────────────────────────────────── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto pb-4"
        onPointerUp={() => { isDragging.current = false; }}
      >
        {noSrt ? (
          <div className="text-center py-20 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm">No SRT transcript loaded.</p>
            <p className="text-xs mt-1 text-gray-700">Add an SRT transcript to this lecture first (Admin → Videos → Edit).</p>
          </div>
        ) : (
          <div>
            {cues.map((cue, idx) => (
              <div key={cue.id}>
                <CueRow
                  cue={cue}
                  isActive={activeCueId === cue.id}
                  isRegressed={regressedIds.has(cue.id)}
                  isEditing={editingId === cue.id}
                  draft={draft}
                  mode={mode}
                  l1Diff={l1Diff.get(cue.id)}
                  l2Diff={l2Diff.get(cue.id)}
                  isL1Accepted={acceptedL1Ids.has(cue.id)}
                  isL1AdminAccepted={adminAcceptedL1Ids.has(cue.id)}
                  isL1AdminRejected={adminRejectedL1Ids.has(cue.id)}
                  isL2AdminAccepted={adminAcceptedL2Ids.has(cue.id)}
                  isL2AdminRejected={adminRejectedL2Ids.has(cue.id)}
                  onEdit={() => startEdit(cue)}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onDraftChange={setDraft}
                  onAcceptL1={() => acceptL1Change(cue.id)}
                  onAdminAcceptL1={() => adminAcceptL1(cue.id)}
                  onAdminRejectL1={() => adminRejectL1(cue.id)}
                  onAdminAcceptL2={() => adminAcceptL2(cue.id)}
                  onAdminRejectL2={() => adminRejectL2(cue.id)}
                  onSeekTo={() => { if (audioRef.current) { audioRef.current.currentTime = cue.startMs / 1000; } }}
                  onEditTimestamp={!selectMode ? openTsEditor : undefined}
                  onDelete={() => deleteCue(cue.id)}
                  selectMode={selectMode}
                  isSelected={selectedIds.has(cue.id)}
                  onCheckboxPointerDown={() => {
                    dragStartId.current = cue.id;
                    isDragging.current = true;
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(cue.id)) {
                        next.delete(cue.id);
                      } else {
                        // Select this cue + next (autoSelectCount - 1) by default
                        const startIdx = cues.findIndex((c) => c.id === cue.id);
                        cues.slice(startIdx, startIdx + autoSelectCount).forEach((c) => next.add(c.id));
                      }
                      return next;
                    });
                  }}
                  onCheckboxPointerEnter={() => {
                    if (isDragging.current && dragStartId.current !== null) {
                      selectRange(dragStartId.current, cue.id);
                    }
                  }}
                />
                {/* Insert strip between rows (hidden in select mode) */}
                {!selectMode && idx < cues.length - 1 && (
                  <div className="flex items-center px-4 h-6 group relative z-10">
                    <div className="flex-1 h-px bg-gray-800/60" />
                    <button
                      onClick={() => insertCueAfter(cue.id)}
                      className="mx-1.5 w-5 h-5 rounded-full bg-gray-900 border border-gray-700 text-gray-600 hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                      title="Insert new cue here"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                      </svg>
                    </button>
                    <div className="flex-1 h-px bg-gray-800/60" />
                  </div>
                )}
                {/* Bottom border for last row */}
                {(selectMode || idx === cues.length - 1) && (
                  <div className="border-b border-gray-800/60" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Select mode action bar ───────────────────────────────────────────── */}
      {selectMode && (
        <div
          className="flex-shrink-0 bg-gray-950 border-t border-orange-500/20 px-4 pt-2.5"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {/* Row 1: mode toggle + selected count */}
          <div className="flex items-center justify-between mb-2">
            {/* Fix Text / Fix Timestamps toggle */}
            <div className="flex items-center rounded-lg border border-gray-700 overflow-hidden text-xs">
              <button
                onClick={() => setSelectAction("text")}
                className={`px-2.5 py-1 transition-colors ${
                  selectAction === "text"
                    ? "bg-orange-500/20 text-orange-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Fix Text
              </button>
              <div className="w-px h-4 bg-gray-700" />
              <button
                onClick={() => setSelectAction("timestamps")}
                className={`px-2.5 py-1 transition-colors ${
                  selectAction === "timestamps"
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Fix Timestamps
              </button>
            </div>
            {selectedIds.size > 0 ? (
              <span className="text-xs text-orange-400 font-medium">
                {selectedIds.size} cue{selectedIds.size > 1 ? "s" : ""} selected
              </span>
            ) : (
              <span className="text-xs text-gray-600">Tap a checkbox to select</span>
            )}
          </div>

          {/* Row 2: actions */}
          <div className="flex items-center justify-end gap-2">
            {selectAction === "text" && (
              <>
                {/* Auto-select count input */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-gray-500 whitespace-nowrap">Auto-select</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={autoSelectCount}
                    onChange={(e) => {
                      const v = Math.min(50, Math.max(1, parseInt(e.target.value) || 1));
                      setAutoSelectCount(v);
                    }}
                    className="w-12 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 text-center outline-none focus:border-orange-500 transition-colors"
                  />
                  <label className="text-[10px] text-gray-500">cues</label>
                </div>
                {selectedIds.size > 0 && (
                  <>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 rounded-xl border border-gray-700 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-semibold text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {regenerating ? <><Spinner /> Regenerating…</> : "✦ Regenerate Transcript"}
                    </button>
                  </>
                )}
              </>
            )}

            {selectAction === "timestamps" && (
              <>
                {selectedIds.size > 0 ? (
                  <>
                    {/* From time */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">From</span>
                      <input
                        value={tsRangeStart}
                        onChange={(e) => setTsRangeStart(e.target.value)}
                        className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-gray-200 outline-none focus:border-blue-500 transition-colors"
                        placeholder="00:00:00,000"
                      />
                      <button
                        onClick={() => setTsRangeStart(msToSrtTime(currentTime * 1000))}
                        title="Snap to current audio position"
                        className="text-gray-600 hover:text-blue-400 transition-colors text-sm leading-none"
                      >
                        📍
                      </button>
                    </div>
                    {/* To time */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">To</span>
                      <input
                        value={tsRangeEnd}
                        onChange={(e) => setTsRangeEnd(e.target.value)}
                        className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-gray-200 outline-none focus:border-blue-500 transition-colors"
                        placeholder="00:00:00,000"
                      />
                      <button
                        onClick={() => setTsRangeEnd(msToSrtTime(currentTime * 1000))}
                        title="Snap to current audio position"
                        className="text-gray-600 hover:text-blue-400 transition-colors text-sm leading-none"
                      >
                        📍
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 rounded-xl border border-gray-700 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleRedistributeTimestamps}
                      disabled={isRedistributing}
                      className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                    >
                      {isRedistributing ? (
                        <>
                          <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          Analysing...
                        </>
                      ) : (
                        <>↺ Redistribute</>
                      )}
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-600">Select cues to fix their timestamps</span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Timestamp editor bottom sheet ────────────────────────────────────── */}
      {tsEditCue && (
        <CueTimestampEditor
          cue={tsEditCue}
          audioRef={audioRef}
          previewCueRef={previewCueRef}
          previewLoopCountRef={previewLoopCountRef}
          audioDuration={duration}
          isLastCue={cues[cues.length - 1]?.id === tsEditCue.id}
          onSave={(startMs, endMs) => saveTsEdit(tsEditCue.id, startMs, endMs)}
          onClose={closeTsEditor}
          onMergeWithNext={() => mergeCueWithNext(tsEditCue.id)}
        />
      )}

      {/* ── Publish confirmation modal ─────────────────────────────────────────── */}
      {publishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !submitting && setPublishConfirm(false)} />
          <div className="relative w-full max-w-sm bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white text-center mb-1">Publish Transcript</h3>
            <p className="text-sm text-gray-400 text-center mb-4">
              This will mark the transcript as <span className="text-emerald-400 font-medium">Approved + Deployed</span> and overwrite the live SRT for users.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPublishConfirm(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Spinner /> : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cue Row ────────────────────────────────────────────────────────────────────

type DraftState = { text: string; startTime: string; endTime: string };

interface CueRowProps {
  cue: SrtCue;
  isActive: boolean;
  isRegressed?: boolean;
  isEditing: boolean;
  draft: DraftState;
  mode: EditorMode;
  l1Diff?: CueDiff;
  l2Diff?: CueDiff;
  isL1Accepted?: boolean;
  isL1AdminAccepted?: boolean;
  isL1AdminRejected?: boolean;
  isL2AdminAccepted?: boolean;
  isL2AdminRejected?: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDraftChange: (d: DraftState) => void;
  onAcceptL1: () => void;
  onAdminAcceptL1?: () => void;
  onAdminRejectL1?: () => void;
  onAdminAcceptL2?: () => void;
  onAdminRejectL2?: () => void;
  onSeekTo: () => void;
  onDelete: () => void;
  onEditTimestamp?: (cue: SrtCue) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onCheckboxPointerDown?: () => void;
  onCheckboxPointerEnter?: () => void;
}

function CueRow({
  cue, isActive, isRegressed, isEditing, draft, mode,
  l1Diff, l2Diff, isL1Accepted,
  isL1AdminAccepted, isL1AdminRejected, isL2AdminAccepted, isL2AdminRejected,
  onEdit, onCancelEdit, onSaveEdit, onDraftChange, onAcceptL1,
  onAdminAcceptL1, onAdminRejectL1, onAdminAcceptL2, onAdminRejectL2,
  onSeekTo, onDelete, onEditTimestamp,
  selectMode, isSelected, onCheckboxPointerDown, onCheckboxPointerEnter,
}: CueRowProps) {
  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500 transition-colors";

  return (
    <div
      data-cue={cue.id}
      className={`px-4 py-3 transition-colors ${
        isRegressed
          ? "bg-red-500/10 border-l-2 border-red-500"
          : isSelected
          ? "bg-orange-500/10 border-l-2 border-orange-500"
          : isActive
          ? "bg-blue-500/10 border-l-2 border-blue-500"
          : "border-l-2 border-transparent hover:bg-gray-900/40"
      }`}
    >
      {isEditing ? (
        /* ── Edit form ── */
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-mono text-gray-600">#{cue.id}</span>
            <span className="text-blue-400">Editing</span>
          </div>
          <textarea
            rows={3}
            value={draft.text}
            onChange={(e) => onDraftChange({ ...draft, text: e.target.value })}
            className={inputCls + " resize-none font-mono"}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-600 mb-1">Start time</label>
              <input
                type="text"
                value={draft.startTime}
                onChange={(e) => onDraftChange({ ...draft, startTime: e.target.value })}
                placeholder="00:00:00,000"
                className={inputCls + " font-mono text-xs"}
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-600 mb-1">End time</label>
              <input
                type="text"
                value={draft.endTime}
                onChange={(e) => onDraftChange({ ...draft, endTime: e.target.value })}
                placeholder="00:00:00,000"
                className={inputCls + " font-mono text-xs"}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancelEdit} className="flex-1 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:border-gray-500 transition-colors">
              Cancel
            </button>
            <button onClick={onSaveEdit} className="flex-1 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-xs font-medium text-white transition-colors">
              Save
            </button>
          </div>
        </div>
      ) : (
        /* ── Display mode ── */
        <div>
          <div className="flex items-start gap-3">
            {/* Checkbox (select mode only) */}
            {selectMode && (
              <div
                className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 cursor-pointer flex items-center justify-center ${
                  isSelected
                    ? "bg-orange-500 border-orange-500"
                    : "border-gray-600 hover:border-orange-400"
                }`}
                onPointerDown={(e) => { e.preventDefault(); onCheckboxPointerDown?.(); }}
                onPointerEnter={onCheckboxPointerEnter}
              >
                {isSelected && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5 text-white">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            )}
            {/* Index + time — click to seek */}
            <button
              onClick={onSeekTo}
              className="flex-shrink-0 text-left group"
              title={isRegressed ? "Regressed timestamp — goes backwards" : "Seek to this cue"}
            >
              <span className={`block text-[10px] font-mono transition-colors ${isRegressed ? "text-red-400" : "text-gray-600 group-hover:text-blue-400"}`}>
                #{cue.id}{isRegressed && " ⚠"}
              </span>
              <span className={`block text-[10px] font-mono transition-colors leading-tight ${isRegressed ? "text-red-400/80" : "text-gray-700 group-hover:text-blue-400"}`}>
                {cue.startTime}<br />{cue.endTime}
              </span>
            </button>

            {/* Text — click to edit */}
            <button
              onClick={onEdit}
              className="flex-1 text-left text-sm text-gray-200 leading-relaxed hover:text-white transition-colors text-left"
              title="Click to edit"
            >
              {cue.text}
            </button>

            {/* Adjust timestamp icon */}
            {onEditTimestamp && (
              <button onClick={() => onEditTimestamp(cue)} className="flex-shrink-0 text-gray-700 hover:text-amber-400 transition-colors pt-0.5" title="Adjust timestamp">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </button>
            )}
            {/* Edit icon */}
            <button onClick={onEdit} className="flex-shrink-0 text-gray-700 hover:text-blue-400 transition-colors pt-0.5" title="Edit cue">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
            </button>
            {/* Delete icon */}
            <button onClick={onDelete} className="flex-shrink-0 text-gray-700 hover:text-red-400 transition-colors pt-0.5" title="Delete cue">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>

          {/* ── L1 diff panel (shown for L2 and admin) ── */}
          {l1Diff && !isL1Accepted && (
            <div className="mt-2 ml-10 rounded-lg border border-gray-800 bg-gray-950/60 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-gray-800 flex items-center justify-between">
                <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wide">Level-1 Edit</span>
                {mode === "l2" && (
                  <button onClick={onAcceptL1} className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-colors font-medium">
                    Accept ✓
                  </button>
                )}
                {mode === "admin" && (
                  isL1AdminAccepted ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 border border-green-500/25 text-green-400 font-medium">Accepted ✓</span>
                  ) : isL1AdminRejected ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-400 font-medium">Rejected ✗</span>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={onAdminAcceptL1} className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-colors font-medium">Accept ✓</button>
                      <button onClick={onAdminRejectL1} className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors font-medium">Reject ✗</button>
                    </div>
                  )
                )}
              </div>
              <div className="px-3 py-2 space-y-1">
                {l1Diff.textChanged && (
                  <>
                    <p className="text-xs font-mono text-red-400 line-through leading-relaxed">{l1Diff.origText}</p>
                    <p className="text-xs font-mono text-green-400 leading-relaxed">{l1Diff.newText}</p>
                  </>
                )}
                {l1Diff.timingChanged && (
                  <p className="text-[10px] text-gray-500 font-mono">
                    <span className="text-red-400">{l1Diff.origStart} → {l1Diff.origEnd}</span>
                    {" → "}
                    <span className="text-green-400">{l1Diff.newStart} → {l1Diff.newEnd}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── L2 diff panel (shown for admin) ── */}
          {l2Diff && mode === "admin" && (
            <div className="mt-1.5 ml-10 rounded-lg border border-gray-800 bg-gray-950/60 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-gray-800 flex items-center justify-between">
                <span className="text-[10px] font-medium text-purple-400 uppercase tracking-wide">Level-2 Edit</span>
                {isL2AdminAccepted ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 border border-green-500/25 text-green-400 font-medium">Accepted ✓</span>
                ) : isL2AdminRejected ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-400 font-medium">Rejected ✗</span>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={onAdminAcceptL2} className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-colors font-medium">Accept ✓</button>
                    <button onClick={onAdminRejectL2} className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors font-medium">Reject ✗</button>
                  </div>
                )}
              </div>
              <div className="px-3 py-2 space-y-1">
                {l2Diff.textChanged && (
                  <>
                    <p className="text-xs font-mono text-red-400 line-through leading-relaxed">{l2Diff.origText}</p>
                    <p className="text-xs font-mono text-purple-400 leading-relaxed">{l2Diff.newText}</p>
                  </>
                )}
                {l2Diff.timingChanged && (
                  <p className="text-[10px] text-gray-500 font-mono">
                    <span className="text-red-400">{l2Diff.origStart} → {l2Diff.origEnd}</span>
                    {" → "}
                    <span className="text-purple-400">{l2Diff.newStart} → {l2Diff.newEnd}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cue Timestamp Editor ─────────────────────────────────────────────────────

interface TsEditorProps {
  cue: SrtCue;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  previewCueRef: React.MutableRefObject<{ startMs: number; endMs: number } | null>;
  previewLoopCountRef: React.MutableRefObject<number>;
  audioDuration: number; // seconds
  isLastCue: boolean;
  onSave: (startMs: number, endMs: number) => void;
  onClose: () => void;
  onMergeWithNext: () => void;
}

function CueTimestampEditor({
  cue, audioRef, previewCueRef, previewLoopCountRef,
  audioDuration, isLastCue, onSave, onClose, onMergeWithNext,
}: TsEditorProps) {
  const [markerStart, setMarkerStart] = useState(cue.startMs);
  const [markerEnd, setMarkerEnd] = useState(cue.endMs);
  const [stripPlaying, setStripPlaying] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const dragTarget = useRef<"start" | "end" | null>(null);

  // Reset strip-play button when audio pauses (preview loop ended by parent's timeupdate handler)
  useEffect(() => {
    if (!stripPlaying) return;
    const audio = audioRef.current;
    if (!audio) return;
    const onPause = () => setStripPlaying(false);
    audio.addEventListener("pause", onPause);
    return () => audio.removeEventListener("pause", onPause);
  }, [stripPlaying, audioRef]);

  // Playhead — tracks current audio position while strip is playing
  const [playheadMs, setPlayheadMs] = useState<number | null>(null);
  useEffect(() => {
    if (!stripPlaying) { setPlayheadMs(null); return; }
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setPlayheadMs(audio.currentTime * 1000);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, [stripPlaying, audioRef]);

  // 20-second zoomed window; drag background left/right to pan
  const windowDuration = 20_000;
  const totalDurationMs = audioDuration > 0
    ? Math.ceil(audioDuration * 1000)
    : Math.max(markerEnd * 2, 60_000);
  const cueMidMs = Math.round((cue.startMs + cue.endMs) / 2);
  const [windowOffset, setWindowOffset] = useState(
    () => Math.max(0, Math.min(cueMidMs - windowDuration / 2, totalDurationMs - windowDuration))
  );
  const windowStartMs = Math.max(0, Math.min(windowOffset, totalDurationMs - windowDuration));

  // Panning the window by dragging the strip background
  const panStartRef = useRef<{ x: number; offset: number } | null>(null);

  const computeMs = (clientX: number): number => {
    if (!stripRef.current) return 0;
    const rect = stripRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(windowStartMs + pct * windowDuration);
  };

  const onMarkerPointerDown = (target: "start" | "end") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // don't let the strip background start panning
    e.currentTarget.setPointerCapture(e.pointerId);
    dragTarget.current = target;
  };

  const onMarkerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragTarget.current) return;
    const ms = computeMs(e.clientX);
    if (dragTarget.current === "start") setMarkerStart(Math.min(ms, markerEnd - 200));
    else setMarkerEnd(Math.max(ms, markerStart + 200));
  };

  const onMarkerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragTarget.current) return;
    const target = dragTarget.current;
    dragTarget.current = null;
    const ms = computeMs(e.clientX);
    let finalMs: number;
    if (target === "start") {
      finalMs = Math.min(ms, markerEnd - 200);
      setMarkerStart(finalMs);
    } else {
      finalMs = Math.max(ms, markerStart + 200);
      setMarkerEnd(finalMs);
    }
    // Seek to dropped position + 1s auto-preview
    const audio = audioRef.current;
    if (audio) {
      previewCueRef.current = null;
      setStripPlaying(false);
      previewCueRef.current = { startMs: finalMs, endMs: finalMs + 1000 };
      previewLoopCountRef.current = 1;
      audio.currentTime = finalMs / 1000;
      audio.play().catch(() => {});
    }
  };

  // Strip background pan handlers
  const onStripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragTarget.current) return; // marker drag takes priority
    e.currentTarget.setPointerCapture(e.pointerId);
    panStartRef.current = { x: e.clientX, offset: windowOffset };
  };
  const onStripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragTarget.current || !panStartRef.current) return;
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    const deltaMs = -((e.clientX - panStartRef.current.x) / rect.width) * windowDuration;
    setWindowOffset(Math.max(0, Math.min(totalDurationMs - windowDuration, panStartRef.current.offset + deltaMs)));
  };
  const onStripPointerUp = () => { panStartRef.current = null; };

  const toggleStripPlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (stripPlaying) {
      previewCueRef.current = null;
      audio.pause();
      setStripPlaying(false);
    } else {
      previewCueRef.current = { startMs: markerStart, endMs: markerEnd };
      previewLoopCountRef.current = 0;
      audio.currentTime = markerStart / 1000;
      audio.play().catch(() => {});
      setStripPlaying(true);
    }
  };

  const startPct = ((markerStart - windowStartMs) / windowDuration) * 100;
  const endPct = ((markerEnd - windowStartMs) / windowDuration) * 100;

  const fmtMs = (ms: number): string => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const tenth = Math.floor((ms % 1000) / 100);
    return `${m}:${String(s).padStart(2, "0")}.${tenth}`;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-gray-700 rounded-t-2xl shadow-2xl flex flex-col"
      style={{ height: "44vh", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <button onClick={() => onSave(markerStart, markerEnd)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Done
        </button>
        <span className="text-xs font-semibold text-gray-300">Adjust Timestamp</span>
        <div className="w-14" />
      </div>

      {/* Cue text preview */}
      <div className="px-4 py-2 text-xs text-gray-500 truncate border-b border-gray-800/60 flex-shrink-0">
        <span className="text-gray-600">#{cue.id}</span> <span className="text-gray-400">{cue.text}</span>
      </div>

      {/* Timeline strip */}
      <div className="px-5 pt-4 pb-1 flex-shrink-0">
        {/* Window edge labels */}
        <div className="flex justify-between mb-1 px-0.5">
          <span className="text-[10px] font-mono text-gray-600">{fmtMs(windowStartMs)}</span>
          <span className="text-[10px] font-mono text-gray-600">{fmtMs(windowStartMs + windowDuration)}</span>
        </div>

        {/* Main zoomed strip — drag background to pan, drag markers to adjust */}
        <div
          ref={stripRef}
          className="relative w-full h-14 select-none touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={onStripPointerDown}
          onPointerMove={onStripPointerMove}
          onPointerUp={onStripPointerUp}
        >
          <div
            className="absolute inset-x-0 top-5 bottom-5 rounded-full bg-gray-800"
            style={{
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
              backgroundSize: `${(1000 / windowDuration) * 100}% 100%`,
              backgroundPositionX: `${((1000 - (windowStartMs % 1000)) % 1000) / windowDuration * 100}%`,
            }}
          />
          <div
            className="absolute top-5 bottom-5 rounded-full bg-amber-500/40 border border-amber-500/60"
            style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
          />
          {/* Start marker (amber) */}
          <div
            className="absolute top-0 bottom-0 w-11 -translate-x-1/2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing z-10"
            style={{ left: `${startPct}%` }}
            onPointerDown={onMarkerPointerDown("start")}
            onPointerMove={onMarkerPointerMove}
            onPointerUp={onMarkerPointerUp}
          >
            <div className="w-1.5 h-10 bg-amber-400 rounded-full shadow-lg shadow-amber-900/50" />
          </div>
          {/* End marker (orange) */}
          <div
            className="absolute top-0 bottom-0 w-11 -translate-x-1/2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing z-10"
            style={{ left: `${endPct}%` }}
            onPointerDown={onMarkerPointerDown("end")}
            onPointerMove={onMarkerPointerMove}
            onPointerUp={onMarkerPointerUp}
          >
            <div className="w-1.5 h-10 bg-orange-400 rounded-full shadow-lg shadow-orange-900/50" />
          </div>
          {/* Playhead */}
          {playheadMs !== null && (
            <div
              className="absolute top-1 bottom-1 w-0.5 bg-white/80 rounded-full z-20 pointer-events-none"
              style={{ left: `${Math.max(0, Math.min(100, ((playheadMs - windowStartMs) / windowDuration) * 100))}%` }}
            />
          )}
        </div>

        {/* Marker time labels */}
        <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[11px] font-mono text-amber-400">{fmtMs(markerStart)}</span>
          <span className="text-[11px] font-mono text-orange-400">{fmtMs(markerEnd)}</span>
        </div>
      </div>

      {/* Strip play button */}
      <div className="flex justify-center py-3 flex-shrink-0">
        <button
          onClick={toggleStripPlay}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 active:bg-gray-600 transition-colors text-sm text-gray-200"
        >
          {stripPlaying ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7 0a.75.75 0 0 1 .75-.75H16.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
              </svg>
              Stop Preview
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
              </svg>
              Play Strip
            </>
          )}
        </button>
      </div>

      {/* Merge with next */}
      {!isLastCue && (
        <div className="flex justify-center flex-shrink-0">
          <button
            onClick={onMergeWithNext}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-gray-700 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 active:bg-gray-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Merge with next cue
          </button>
        </div>
      )}
    </div>
  );
}

// ── Success / Published screens ───────────────────────────────────────────────

function SuccessScreen({ mode, level, onBack }: { mode: EditorMode; level: 1 | 2; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-green-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-white mb-1">Review Submitted!</h2>
      <p className="text-sm text-gray-400 text-center mb-6">
        Your Level {level} review has been submitted. The admin has been notified.
      </p>
      <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-medium text-white transition-colors">
        Back to Assignments
      </button>
    </div>
  );
}

function PublishedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-emerald-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-white mb-1">Transcript Published!</h2>
      <p className="text-sm text-gray-400 text-center mb-6">
        The reviewed transcript is now live for all users.
      </p>
      <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-sm font-medium text-white transition-colors">
        Back to Admin
      </button>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}
