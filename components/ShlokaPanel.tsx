"use client";

import { useEffect, useState } from "react";
import { getShlokaData } from "@/services/shloka.service";
import { ShlokaEntry } from "@/types/shloka";

interface Props {
  open: boolean;
  onClose: () => void;
  videoId: number;
  locale: string;
  langName: string;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function ShlokaCard({ entry }: { entry: ShlokaEntry }) {
  const [wordExpanded, setWordExpanded] = useState(false);
  const [purportExpanded, setPurportExpanded] = useState(false);

  const preview = entry.shlokaText.split(/\s+/).slice(0, 8).join(" ");

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      {/* Card header: index chip + shloka preview */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/60">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-bold flex items-center justify-center">
          {entry.index}
        </span>
        <p className="text-gray-400 text-xs line-clamp-1 font-mono">{preview}…</p>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Shloka text — always visible */}
        <p className="text-orange-300 text-base leading-relaxed font-medium">{entry.shlokaText}</p>

        {/* Translation — always visible */}
        <p className="text-gray-300 text-sm leading-relaxed">{entry.translation}</p>

        {/* Word by Word — toggle */}
        <div>
          <button
            onClick={() => setWordExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronIcon expanded={wordExpanded} />
            Word by Word
          </button>
          {wordExpanded && (
            <p className="mt-2 text-xs text-gray-400 leading-relaxed font-mono bg-gray-900 rounded-lg px-3 py-2">
              {entry.wordMeaning}
            </p>
          )}
        </div>

        {/* Purport — toggle */}
        <div>
          <button
            onClick={() => setPurportExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronIcon expanded={purportExpanded} />
            Purport
          </button>
          {purportExpanded && (
            <p className="mt-2 text-sm text-gray-300 leading-relaxed bg-gray-900/60 rounded-lg px-3 py-2">
              {entry.purport}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShlokaPanel({ open, onClose, videoId, locale, langName }: Props) {
  const [shlokas, setShlokas] = useState<ShlokaEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShlokas(null);
    getShlokaData(videoId, locale)
      .then((data) => setShlokas(data?.shlokas ?? []))
      .catch(() => setShlokas([]))
      .finally(() => setLoading(false));
  }, [open, locale, videoId]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-4xl xl:max-w-6xl bg-[#0d0d0d] flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white text-lg font-semibold">Śloka Guide</h2>
                {shlokas && shlokas.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium border border-orange-500/30">
                    {shlokas.length}
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-xs">{langName}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && shlokas !== null && shlokas.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600 px-8 text-center py-16">
              <span className="text-4xl">🕉</span>
              <p className="text-sm">No śloka guide available for this lecture in {langName} yet.</p>
            </div>
          )}

          {!loading && shlokas && shlokas.length > 0 && (
            <div className="px-4 py-4 space-y-4">
              {shlokas.map((entry) => (
                <ShlokaCard key={entry.index} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
