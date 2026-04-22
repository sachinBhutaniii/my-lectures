"use client";

import { useEffect, useState } from "react";
import { WISDOMS, Wisdom } from "@/data/wisdoms";

const CATEGORY_STYLES: Record<string, { pill: string; glow: string }> = {
  "The Voyage":     { pill: "bg-sky-900/70 text-sky-300 border-sky-700/60",       glow: "from-sky-600/20"     },
  "The Books":      { pill: "bg-amber-900/70 text-amber-300 border-amber-700/60",  glow: "from-amber-600/20"   },
  "Global Mission": { pill: "bg-emerald-900/70 text-emerald-300 border-emerald-700/60", glow: "from-emerald-600/20" },
  "The Man":        { pill: "bg-purple-900/70 text-purple-300 border-purple-700/60", glow: "from-purple-600/20" },
  "Legacy":         { pill: "bg-orange-900/70 text-orange-300 border-orange-700/60", glow: "from-orange-600/20" },
};

const SESSION_WISDOM_KEY = "bdd_wisdom_index";

export function getWisdomForToday(): Wisdom {
  // sessionStorage is only available in the browser
  if (typeof window === "undefined") return WISDOMS[0];

  // Pick a random index once per session; reuse it so card + popup match
  let index = parseInt(sessionStorage.getItem(SESSION_WISDOM_KEY) ?? "", 10);
  if (isNaN(index)) {
    index = Math.floor(Math.random() * WISDOMS.length);
    sessionStorage.setItem(SESSION_WISDOM_KEY, String(index));
  }
  return WISDOMS[index];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function WisdomModal({ open, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const wisdom = getWisdomForToday();

  // Animate in when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => setVisible(true), 30);
    } else {
      setVisible(false);
    }
  }, [open]);

  function dismiss() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  if (!open) return null;

  const style = CATEGORY_STYLES[wisdom.category] ?? CATEGORY_STYLES["Legacy"];

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={dismiss}
        className={`fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* ── Modal card ── */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center px-5 pointer-events-none transition-all duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`pointer-events-auto w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/80
            border border-white/[0.08] bg-[#0e0e0e]
            transition-all duration-300 ${visible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}
        >
          {/* Top accent bar */}
          <div className="h-[3px] bg-gradient-to-r from-orange-600 via-amber-300 to-orange-600" />

          {/* Glow bleed */}
          <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b ${style.glow} to-transparent opacity-40 pointer-events-none`} />

          <div className="relative p-6">
            {/* ── Top row ── */}
            <div className="flex items-center mb-5">
              <span className="text-orange-500 text-[10px] font-bold tracking-[0.18em] uppercase">
                ✦ Wisdom of the Day
              </span>
            </div>

            {/* ── Emoji + category pill ── */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[42px] leading-none select-none">{wisdom.emoji}</span>
              <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${style.pill}`}>
                {wisdom.category}
              </span>
            </div>

            {/* ── Title ── */}
            <h2 className="text-white text-[19px] font-bold leading-snug mb-3 tracking-tight">
              {wisdom.title}
            </h2>

            {/* ── Rule ── */}
            <div className="w-8 h-[2px] bg-orange-500 rounded-full mb-3" />

            {/* ── Body ── */}
            <p className="text-gray-400 text-sm leading-[1.75]">{wisdom.body}</p>

            {/* ── Attribution ── */}
            <p className="text-gray-600 text-[11px] mt-4 italic">— Srila Gurudev</p>

            {/* ── CTA ── */}
            <div className="mt-6">
              <button
                onClick={dismiss}
                className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.97] text-white text-sm font-semibold py-3 rounded-xl transition-all"
              >
                Begin Listening
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
