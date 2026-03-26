"use client";

import { useCallback } from "react";

const pctKey = (id: number) => `bdd_pct_${id}`;

export function useListenProgress() {
  const getListenPct = useCallback((id: number): number => {
    if (typeof window === "undefined") return 0;
    try {
      const v = localStorage.getItem(pctKey(id));
      if (v === null) return 0;
      return parseFloat(v) || 0;
    } catch {
      return 0;
    }
  }, []);

  return { getListenPct };
}
