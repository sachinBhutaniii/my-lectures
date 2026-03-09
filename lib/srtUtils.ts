export interface SrtCue {
  id: number;
  startTime: string; // "00:00:01,000"
  endTime: string;   // "00:00:03,500"
  startMs: number;
  endMs: number;
  text: string;
}

export interface CueDiff {
  id: number;
  textChanged: boolean;
  timingChanged: boolean;
  origText: string;
  newText: string;
  origStart: string;
  newStart: string;
  origEnd: string;
  newEnd: string;
}

/**
 * Parse an SRT timestamp into milliseconds.
 * Handles: "HH:MM:SS,mmm", "MM:SS,mmm", "HH:MM:SS:mmm" (colon instead of comma),
 * "MM:SS:mmm", and variable-length milliseconds.
 */
export function timeToMs(t: string): number {
  if (!t) return 0;
  t = t.trim();

  // If there's a comma, split on it: left is H:M:S, right is ms
  const commaIdx = t.indexOf(",");
  if (commaIdx !== -1) {
    const hms = t.slice(0, commaIdx);
    const msStr = t.slice(commaIdx + 1).padEnd(3, "0").slice(0, 3);
    const ms = parseInt(msStr, 10);
    const parts = hms.split(":").map(Number);
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) [h, m, s] = parts;
    else if (parts.length === 2) [m, s] = parts;
    return h * 3600000 + m * 60000 + s * 1000 + ms;
  }

  // No comma — all colons. Last segment might be milliseconds.
  // e.g. "00:10:827" = 0min 10sec 827ms, "01:07:27" = 1min 7sec 27*10ms
  const parts = t.split(":").map(Number);
  if (parts.length === 3) {
    // Could be HH:MM:SS or MM:SS:mmm — disambiguate by checking if last part > 59
    if (parts[2] > 59) {
      // MM:SS:mmm format (last part is ms)
      const msStr = t.split(":")[2].padEnd(3, "0").slice(0, 3);
      return parts[0] * 60000 + parts[1] * 1000 + parseInt(msStr, 10);
    }
    // Standard HH:MM:SS (no ms)
    return parts[0] * 3600000 + parts[1] * 60000 + parts[2] * 1000;
  }
  if (parts.length === 2) {
    return parts[0] * 60000 + parts[1] * 1000;
  }
  return 0;
}

export function msToTime(ms: number): string {
  if (isNaN(ms) || ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mil = ms % 1000;
  return (
    [h, m, s].map((n) => String(n).padStart(2, "0")).join(":") +
    "," +
    String(mil).padStart(3, "0")
  );
}

export function parseSrt(srt: string): SrtCue[] {
  if (!srt?.trim()) return [];
  const blocks = srt.trim().split(/\n\n+/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const id = parseInt(lines[0], 10);
    if (isNaN(id)) continue;
    // Split timestamp line by --> (handles any timestamp format)
    const arrowIdx = lines[1].indexOf("-->");
    if (arrowIdx === -1) continue;
    const startTime = lines[1].slice(0, arrowIdx).trim();
    const endTime = lines[1].slice(arrowIdx + 3).trim();
    if (!startTime || !endTime) continue;
    const text = lines.slice(2).join("\n").trim();
    cues.push({
      id,
      startTime,
      endTime,
      startMs: timeToMs(startTime),
      endMs: timeToMs(endTime),
      text,
    });
  }
  return cues;
}

export function serializeSrt(cues: SrtCue[]): string {
  return (
    cues
      .map((c) => `${c.id}\n${c.startTime} --> ${c.endTime}\n${c.text}`)
      .join("\n\n") + "\n"
  );
}

export function diffCues(
  original: SrtCue[],
  edited: SrtCue[]
): Map<number, CueDiff> {
  const origMap = new Map(original.map((c) => [c.id, c]));
  const diffs = new Map<number, CueDiff>();
  for (const ec of edited) {
    const oc = origMap.get(ec.id);
    if (!oc) continue;
    const textChanged = oc.text !== ec.text;
    const timingChanged =
      oc.startTime !== ec.startTime || oc.endTime !== ec.endTime;
    if (textChanged || timingChanged) {
      diffs.set(ec.id, {
        id: ec.id,
        textChanged,
        timingChanged,
        origText: oc.text,
        newText: ec.text,
        origStart: oc.startTime,
        newStart: ec.startTime,
        origEnd: oc.endTime,
        newEnd: ec.endTime,
      });
    }
  }
  return diffs;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function offsetCues(cues: SrtCue[], offsetMs: number): SrtCue[] {
  return cues.map((c) => ({
    ...c,
    startMs: c.startMs + offsetMs,
    endMs: c.endMs + offsetMs,
    startTime: msToTime(c.startMs + offsetMs),
    endTime: msToTime(c.endMs + offsetMs),
  }));
}
