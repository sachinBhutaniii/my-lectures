// What happens to the transcript when a line is confirmed in Timeline Editor Mode (Next, Prev,
// Exit / ✕ / phone Back). The confirmed line gets the new times and text. It is marked
// "reviewed" by Next ("this line is done"), and by Prev / Exit only if something was changed —
// just opening a line and leaving it doesn't count as reviewing it. Then, around it:
// - Next ("pack"): the following lines follow on end-to-end, keeping their lengths, so they stay
//   close when the AI timing has drifted — but only up to the first REVIEWED line. Lines the
//   proofreader already confirmed are never moved again (pressing Next on line 1 used to drag
//   an already-fixed line 2 back and undo the fix).
// - Prev / Exit: following lines are pushed later only where they would overlap.
// - Earlier lines that would overlap are pulled earlier (again never a reviewed one).
// Lines with broken timing (ending before they start, an AI glitch) stop the moving too, so a
// glitch is never spread into negative times further on.
// No imports, so it is tested with `node --test` (tests/timelineConfirm.test.mjs).

export interface TimedCue {
  startMs: number;
  endMs: number;
  startTime: string;
  endTime: string;
  text: string;
  reviewed?: boolean;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** "HH:MM:SS,mmm" (same as the editor's SRT times). */
export function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

function retime<T extends TimedCue>(c: T, startMs: number, endMs: number): T {
  return { ...c, startMs, endMs, startTime: msToSrtTime(startMs), endTime: msToSrtTime(endMs) };
}

/**
 * A new array: line `idx` confirmed with these times/text, and the lines around it adjusted.
 * `how`: "next" packs the following lines and marks the line reviewed; "stay" (Prev / Exit)
 * only pushes overlapping lines and marks it reviewed only if its times or text changed.
 */
export function confirmTimelineLine<T extends TimedCue>(
  cues: T[], idx: number, startMs: number, endMs: number, text: string, how: "next" | "stay",
): T[] {
  if (idx < 0 || idx >= cues.length) return cues;
  const pack = how === "next";
  const before = cues[idx];
  const changed = before.startMs !== startMs || before.endMs !== endMs || before.text !== text;
  const next = [...cues];
  next[idx] = { ...retime(before, startMs, endMs), text, reviewed: before.reviewed || pack || changed };

  for (let i = idx + 1; i < next.length; i++) {
    const cur = next[i];
    const prevEnd = next[i - 1].endMs;
    if (!pack && prevEnd <= cur.startMs) break; // no overlap: nothing further to move
    if (cur.reviewed) break;                     // already confirmed: never moved again
    const dur = cur.endMs - cur.startMs;
    if (dur <= 0) break;                         // broken timing: don't spread it
    next[i] = retime(cur, prevEnd, prevEnd + dur);
  }

  for (let i = idx - 1; i >= 0; i--) {
    const cur = next[i];
    const nextStart = next[i + 1].startMs;
    if (cur.endMs <= nextStart) break;
    if (cur.reviewed) break;
    const dur = cur.endMs - cur.startMs;
    if (dur <= 0) break;
    next[i] = retime(cur, Math.max(0, nextStart - dur), nextStart);
  }
  return next;
}
