"use client";

import { useEffect, useRef } from "react";

interface Props {
  transcript?: string;
  search: string;
  highlightIndex: number;
  autoScroll: boolean;
}

function splitPhrases(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function TranscriptView({ transcript, search, highlightIndex, autoScroll }: Props) {
  const phrases = splitPhrases(transcript || "");
  const activeRef = useRef<HTMLParagraphElement>(null);

  const filtered = search
    ? phrases.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
    : phrases;

  // Scroll active phrase into view only when autoScroll is on
  useEffect(() => {
    if (autoScroll) {
      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightIndex, autoScroll]);

  if (!transcript) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        No transcript available
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-2 relative">
      {filtered.map((phrase, i) => {
        const isActive = autoScroll && !search && i === highlightIndex % filtered.length;
        return (
          <p
            key={i}
            ref={isActive ? activeRef : undefined}
            className={`text-lg leading-relaxed mb-6 transition-colors duration-300 ${
              isActive
                ? "text-white font-medium"
                : autoScroll
                ? "text-gray-500"
                : "text-gray-300"
            }`}
          >
            {phrase}
          </p>
        );
      })}

      {/* Floating note icon */}
      <button className="sticky bottom-4 float-right text-orange-400 bg-black/60 rounded-full p-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </button>
    </div>
  );
}
