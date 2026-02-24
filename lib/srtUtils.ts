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

export function timeToMs(t: string): number {
  if (!t) return 0;
  t = t.trim();
  const [hms, msStr = "0"] = t.split(",");
  const ms = parseInt(msStr.padEnd(3, "0").slice(0, 3), 10);
  const parts = hms.split(":");
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) {
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    s = parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    m = parseInt(parts[0], 10);
    s = parseInt(parts[1], 10);
  }
  return h * 3600000 + m * 60000 + s * 1000 + ms;
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
    // Match flexible SRT timestamps: HH:MM:SS,mmm or MM:SS,mmm (with 1-3 ms digits)
    const m = lines[1].match(
      /(\d{1,2}(?::\d{1,2}){1,2},\d{1,3})\s*-->\s*(\d{1,2}(?::\d{1,2}){1,2},\d{1,3})/
    );
    if (!m) continue;
    const text = lines.slice(2).join("\n").trim();
    cues.push({
      id,
      startTime: m[1],
      endTime: m[2],
      startMs: timeToMs(m[1]),
      endMs: timeToMs(m[2]),
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
