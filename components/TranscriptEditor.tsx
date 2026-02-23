"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  SrtCue, CueDiff,
  parseSrt, serializeSrt, diffCues, timeToMs, formatTime,
} from "@/lib/srtUtils";
import {
  TranscriptEditorData,
  saveTranscriptDraft,
  submitTranscriptReview,
  publishTranscript,
} from "@/services/video.service";

type EditorMode = "l1" | "l2" | "admin";

interface Props {
  data: TranscriptEditorData;
  mode: EditorMode;
  level?: 1 | 2;
  onBack: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ── Main component ─────────────────────────────────────────────────────────────

export default function TranscriptEditor({ data, mode, level = 1, onBack }: Props) {
  // Working cues
  const [cues, setCues] = useState<SrtCue[]>([]);
  const [l1Diff, setL1Diff] = useState<Map<number, CueDiff>>(new Map());
  const [l2Diff, setL2Diff] = useState<Map<number, CueDiff>>(new Map());

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ text: "", startTime: "", endTime: "" });

  // Audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [activeCueId, setActiveCueId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

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

  // ── Initialise cues ──────────────────────────────────────────────────────────
  useEffect(() => {
    const orig = parseSrt(data.originalSrt ?? "");
    const l1 = parseSrt(data.level1Srt ?? "");
    const l2 = parseSrt(data.level2Srt ?? "");

    origCuesRef.current = orig;

    if (mode === "l1") {
      setCues(l1.length > 0 ? l1 : orig);
    } else if (mode === "l2") {
      // L2 starts from original; L1 diff is highlighted for acceptance
      setCues(l2.length > 0 ? l2 : orig);
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

  // ── Active cue + auto-scroll ─────────────────────────────────────────────────
  useEffect(() => {
    const ms = currentTime * 1000;
    const active = cues.find((c) => ms >= c.startMs && ms < c.endMs);
    if (active && active.id !== activeCueId) {
      setActiveCueId(active.id);
      if (autoScroll && editingId === null) {
        document
          .querySelector(`[data-cue="${active.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentTime, cues, activeCueId, autoScroll, editingId]);

  // ── Auto-save (L1 / L2 only) ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "admin" || cues.length === 0) return;
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveTranscriptDraft(data.id, level as 1 | 2, serializeSrt(cues));
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
  };
  const acceptAllL1 = () => {
    setCues((prev) =>
      prev.map((c) => {
        const diff = l1Diff.get(c.id);
        if (!diff) return c;
        return { ...c, text: diff.newText, startTime: diff.newStart, endTime: diff.newEnd, startMs: timeToMs(diff.newStart), endMs: timeToMs(diff.newEnd) };
      })
    );
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

  const pendingL1Changes = l1Diff.size;
  const hasL2 = data.level2Srt != null;

  if (submitted) return <SuccessScreen mode={mode} level={level} onBack={onBack} />;
  if (publishDone) return <PublishedScreen onBack={onBack} />;

  const noSrt = cues.length === 0;

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden" onTouchEnd={handleTripleTap}>
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
            <span className="text-xs text-gray-500 tabular-nums flex-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {/* Speed */}
            <div className="flex items-center gap-0.5">
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
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
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
      {mode === "l2" && pendingL1Changes > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-purple-500/5 border-b border-purple-500/20">
          <p className="text-xs text-purple-300">
            <span className="font-semibold">{pendingL1Changes}</span> Level-1 edit{pendingL1Changes > 1 ? "s" : ""} to review
          </p>
          <button
            onClick={acceptAllL1}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-colors"
          >
            Accept All Changes
          </button>
        </div>
      )}

      {/* ── Admin diff legend ─────────────────────────────────────────────────── */}
      {mode === "admin" && (l1Diff.size > 0 || l2Diff.size > 0) && (
        <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-amber-500/5 border-b border-amber-500/15 text-[11px] text-gray-500">
          <span>Diffs shown below each changed cue:</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />L1 vs Original</span>
          {hasL2 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" />L2 vs L1</span>}
        </div>
      )}

      {/* ── Cue list ──────────────────────────────────────────────────────────── */}
      <div ref={listRef} className="flex-1 overflow-y-auto pb-24">
        {noSrt ? (
          <div className="text-center py-20 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm">No SRT transcript loaded.</p>
            <p className="text-xs mt-1 text-gray-700">Add an SRT transcript to this lecture first (Admin → Videos → Edit).</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {cues.map((cue) => (
              <CueRow
                key={cue.id}
                cue={cue}
                isActive={activeCueId === cue.id}
                isEditing={editingId === cue.id}
                draft={draft}
                mode={mode}
                l1Diff={l1Diff.get(cue.id)}
                l2Diff={l2Diff.get(cue.id)}
                onEdit={() => startEdit(cue)}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onDraftChange={setDraft}
                onAcceptL1={() => acceptL1Change(cue.id)}
                onSeekTo={() => { if (audioRef.current) { audioRef.current.currentTime = cue.startMs / 1000; } }}
              />
            ))}
          </div>
        )}
      </div>

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
  isEditing: boolean;
  draft: DraftState;
  mode: EditorMode;
  l1Diff?: CueDiff;
  l2Diff?: CueDiff;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDraftChange: (d: DraftState) => void;
  onAcceptL1: () => void;
  onSeekTo: () => void;
}

function CueRow({
  cue, isActive, isEditing, draft, mode,
  l1Diff, l2Diff,
  onEdit, onCancelEdit, onSaveEdit, onDraftChange, onAcceptL1, onSeekTo,
}: CueRowProps) {
  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500 transition-colors";

  return (
    <div
      data-cue={cue.id}
      className={`px-4 py-3 transition-colors ${
        isActive
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
            {/* Index + time — click to seek */}
            <button
              onClick={onSeekTo}
              className="flex-shrink-0 text-left group"
              title="Seek to this cue"
            >
              <span className="block text-[10px] font-mono text-gray-600 group-hover:text-blue-400 transition-colors">#{cue.id}</span>
              <span className="block text-[10px] font-mono text-gray-700 group-hover:text-blue-400 transition-colors leading-tight">
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

            {/* Edit icon */}
            <button onClick={onEdit} className="flex-shrink-0 text-gray-700 hover:text-blue-400 transition-colors pt-0.5" title="Edit cue">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
            </button>
          </div>

          {/* ── L1 diff panel (shown for L2 and admin) ── */}
          {l1Diff && (
            <div className="mt-2 ml-10 rounded-lg border border-gray-800 bg-gray-950/60 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-gray-800 flex items-center justify-between">
                <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wide">Level-1 Edit</span>
                {mode === "l2" && (
                  <button
                    onClick={onAcceptL1}
                    className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-colors font-medium"
                  >
                    Accept ✓
                  </button>
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
              <div className="px-3 py-1.5 border-b border-gray-800">
                <span className="text-[10px] font-medium text-purple-400 uppercase tracking-wide">Level-2 Edit</span>
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
