"use client";

import { useCallback } from "react";

export interface LevelResult {
  score: number;
  maxScore: number;
  passed: boolean;
  completed: boolean;
  attemptedAt: string;
}

const PROGRESS_KEY = "bdd_jnana_progress";   // { "s<id>_l<n>": LevelResult }
const LEVELS_KEY   = "bdd_jnana_levels";      // { "s<id>": number }
const SECTIONS_KEY = "bdd_jnana_sections";    // { "c<id>": number[] }

function load<T>(key: string): T {
  if (typeof window === "undefined") return {} as T;
  try { return JSON.parse(localStorage.getItem(key) || "{}") as T; }
  catch { return {} as T; }
}
function save(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function useJnanaProgress() {
  const getLevelResult = useCallback((sectionId: number, levelIdx: number): LevelResult | null => {
    const d = load<Record<string, LevelResult>>(PROGRESS_KEY);
    return d[`s${sectionId}_l${levelIdx}`] ?? null;
  }, []);

  const saveLevelResult = useCallback((sectionId: number, levelIdx: number, result: LevelResult) => {
    const d = load<Record<string, LevelResult>>(PROGRESS_KEY);
    d[`s${sectionId}_l${levelIdx}`] = result;
    save(PROGRESS_KEY, d);
  }, []);

  const getLevelCount = useCallback((sectionId: number): number => {
    const d = load<Record<string, number>>(LEVELS_KEY);
    return d[`s${sectionId}`] ?? 2;
  }, []);

  const saveLevelCount = useCallback((sectionId: number, count: number) => {
    const d = load<Record<string, number>>(LEVELS_KEY);
    d[`s${sectionId}`] = count;
    save(LEVELS_KEY, d);
  }, []);

  const getSectionIds = useCallback((courseId: number): number[] => {
    const d = load<Record<string, number[]>>(SECTIONS_KEY);
    return d[`c${courseId}`] ?? [];
  }, []);

  const saveSectionIds = useCallback((courseId: number, ids: number[]) => {
    const d = load<Record<string, number[]>>(SECTIONS_KEY);
    d[`c${courseId}`] = ids;
    save(SECTIONS_KEY, d);
  }, []);

  const getCourseProgressPercent = useCallback((courseId: number): number => {
    const sectionIds = load<Record<string, number[]>>(SECTIONS_KEY)[`c${courseId}`] ?? [];
    if (!sectionIds.length) return 0;
    const prog = load<Record<string, LevelResult>>(PROGRESS_KEY);
    const lvl  = load<Record<string, number>>(LEVELS_KEY);
    let total = 0, passed = 0;
    sectionIds.forEach(sid => {
      const n = lvl[`s${sid}`] ?? 2;
      total += n;
      for (let i = 0; i < n; i++) {
        if (prog[`s${sid}_l${i}`]?.passed) passed++;
      }
    });
    return total === 0 ? 0 : Math.round((passed / total) * 100);
  }, []);

  const isCourseCompleted = useCallback((courseId: number): boolean => {
    const sectionIds = load<Record<string, number[]>>(SECTIONS_KEY)[`c${courseId}`] ?? [];
    if (!sectionIds.length) return false;
    const prog = load<Record<string, LevelResult>>(PROGRESS_KEY);
    const lvl  = load<Record<string, number>>(LEVELS_KEY);
    return sectionIds.every(sid => {
      const n = lvl[`s${sid}`] ?? 2;
      return prog[`s${sid}_l${n - 1}`]?.passed === true;
    });
  }, []);

  return {
    getLevelResult,
    saveLevelResult,
    getLevelCount,
    saveLevelCount,
    getSectionIds,
    saveSectionIds,
    getCourseProgressPercent,
    isCourseCompleted,
  };
}
