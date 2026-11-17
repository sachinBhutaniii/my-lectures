// Repair for a cut-short L1 draft: when a saved draft is missing the end of the transcript,
// the editor appends the original lines that are missing. It must NEVER fire for a complete
// draft whose timings were moved earlier (Timeline Editor "Next" re-times all later lines),
// or the proofreader sees the original, unproofread ending again (Saroj's #116 got 60
// duplicated lines this way). So it decides by CONTENT, not by where the last line ends.
// No imports, so it is tested with `node --test` (tests/draftRecovery.test.mjs).

export interface CueLike {
  startMs: number;
  endMs: number;
  text: string;
}

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The original lines missing from the end of the draft ([] when the draft is complete).
 * 1. If the draft's last line matches an original line (by text), only the lines after the
 *    LAST such match are missing — timings are ignored.
 * 2. If the last line was edited (no match), recover only when the draft is clearly cut short:
 *    under 80% of the original's lines AND ending before 95% of the audio.
 */
export function missingOriginalTail<T extends CueLike>(draft: T[], original: T[]): T[] {
  if (draft.length === 0 || original.length === 0) return [];
  const lastText = norm(draft[draft.length - 1].text);
  for (let i = original.length - 1; i >= 0; i--) {
    if (norm(original[i].text) === lastText) return original.slice(i + 1);
  }
  const draftEnd = draft[draft.length - 1].endMs;
  const origEnd = original[original.length - 1].endMs;
  const sane = (cs: T[]) => cs.every((c) => c.startMs >= 0 && c.endMs >= c.startMs);
  if (!sane(draft) || !sane(original) || origEnd <= 0 || draftEnd <= 0) return [];
  if (draft.length < original.length * 0.8 && draftEnd < origEnd * 0.95) {
    return original.filter((c) => c.startMs > draftEnd);
  }
  return [];
}
