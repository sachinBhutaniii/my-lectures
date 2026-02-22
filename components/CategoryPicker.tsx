"use client";

import { useState } from "react";

export interface Category {
  id: string;
  label: string;
  keywords: string[];
  gradient: string;
  ring: string;
  icon: React.ReactNode;
}

const BgIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    {/* Chariot wheel */}
    <circle cx="20" cy="20" r="13" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="20" cy="20" r="3.5" fill="white" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const r = (deg * Math.PI) / 180;
      return (
        <line
          key={deg}
          x1={20 + 3.5 * Math.cos(r)}
          y1={20 + 3.5 * Math.sin(r)}
          x2={20 + 13 * Math.cos(r)}
          y2={20 + 13 * Math.sin(r)}
          stroke="white"
          strokeWidth="1.4"
        />
      );
    })}
    {/* Om symbol simplified */}
    <text x="20" y="24" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">ॐ</text>
  </svg>
);

const SbIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    {/* Open book / scroll */}
    <path d="M8 10 Q20 7 32 10 L32 30 Q20 27 8 30 Z" stroke="white" strokeWidth="1.6" fill="white" fillOpacity="0.12" />
    <line x1="20" y1="8.5" x2="20" y2="29.5" stroke="white" strokeWidth="1.4" />
    {/* Lines of text */}
    {[14, 18, 22, 26].map((y) => (
      <line key={y} x1="11" y1={y} x2="18" y2={y} stroke="white" strokeWidth="1.2" strokeOpacity="0.7" />
    ))}
    {[14, 18, 22, 26].map((y) => (
      <line key={y + "r"} x1="22" y1={y} x2="29" y2={y} stroke="white" strokeWidth="1.2" strokeOpacity="0.7" />
    ))}
    {/* Scroll ends */}
    <ellipse cx="8" cy="20" rx="2.5" ry="10" stroke="white" strokeWidth="1.4" fill="white" fillOpacity="0.1" />
    <ellipse cx="32" cy="20" rx="2.5" ry="10" stroke="white" strokeWidth="1.4" fill="white" fillOpacity="0.1" />
  </svg>
);

const CcIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    {/* Dancing figure (Chaitanya Mahaprabhu) */}
    {/* Head */}
    <circle cx="20" cy="10" r="4" stroke="white" strokeWidth="1.6" fill="white" fillOpacity="0.15" />
    {/* Body */}
    <path d="M20 14 Q17 19 15 24" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    {/* Arms raised in joy */}
    <path d="M20 16 Q13 12 10 9" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M20 16 Q27 12 30 9" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    {/* Legs */}
    <path d="M15 24 Q12 29 11 33" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M15 24 Q18 29 20 33" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    {/* Musical notes */}
    <text x="27" y="22" fontSize="9" fill="white" fillOpacity="0.8">♪</text>
    <text x="24" y="30" fontSize="7" fill="white" fillOpacity="0.6">♫</text>
  </svg>
);

const FestivalIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    {/* Diya lamp body */}
    <path d="M12 26 Q13 22 20 22 Q27 22 28 26 Q26 30 20 31 Q14 30 12 26 Z"
      stroke="white" strokeWidth="1.6" fill="white" fillOpacity="0.15" />
    {/* Wick */}
    <line x1="20" y1="22" x2="20" y2="19" stroke="white" strokeWidth="1.4" />
    {/* Flame */}
    <path d="M20 19 Q17 15 18.5 11 Q20 8 20 8 Q20 8 21.5 11 Q23 15 20 19 Z"
      fill="white" fillOpacity="0.9" />
    {/* Flame inner */}
    <path d="M20 18 Q19 15 19.5 12.5 Q20 11 20 11 Q20 11 20.5 12.5 Q21 15 20 18 Z"
      fill="#fbbf24" />
    {/* Glow dots */}
    {[[10, 14], [30, 14], [8, 24], [32, 24]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="1.5" fill="white" fillOpacity="0.5" />
    ))}
    {/* Oil fill */}
    <path d="M14 27 Q20 29 26 27" stroke="white" strokeWidth="1" strokeOpacity="0.5" />
  </svg>
);

const OthersIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    {/* 4 sparkle stars */}
    {[[12, 12], [28, 12], [12, 28], [28, 28]].map(([cx, cy], i) => (
      <g key={i}>
        <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} stroke="white" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6" />
        <line x1={cx + 3} y1={cy - 3} x2={cx - 3} y2={cy + 3} stroke="white" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6" />
      </g>
    ))}
    {/* Center dot */}
    <circle cx="20" cy="20" r="2" fill="white" fillOpacity="0.4" />
  </svg>
);

export const CATEGORIES: Category[] = [
  {
    id: "bhagavad-gita",
    label: "Bhagavad Gita",
    keywords: ["bhagavad", "gita", "b.g.", "bg"],
    gradient: "from-orange-900/70 to-orange-700/30",
    ring: "ring-orange-400",
    icon: <BgIcon />,
  },
  {
    id: "srimad-bhagawatam",
    label: "Srimad Bhagawatam",
    keywords: ["bhagawatam", "bhagavatam", "s.b.", "sb", "srimad"],
    gradient: "from-blue-900/70 to-blue-700/30",
    ring: "ring-blue-400",
    icon: <SbIcon />,
  },
  {
    id: "chaitanya-charitamrita",
    label: "Chaitanya Charitamrita",
    keywords: ["chaitanya", "charitamrita", "c.c.", "cc"],
    gradient: "from-emerald-900/70 to-emerald-700/30",
    ring: "ring-emerald-400",
    icon: <CcIcon />,
  },
  {
    id: "festival",
    label: "Festival Lectures",
    keywords: ["festival", "janmashtami", "gaura", "nityananda", "rama navami", "ekadashi", "diwali", "holi", "vyasa"],
    gradient: "from-yellow-900/70 to-amber-700/30",
    ring: "ring-yellow-400",
    icon: <FestivalIcon />,
  },
  {
    id: "others",
    label: "Others",
    keywords: [],
    gradient: "from-purple-900/70 to-purple-700/30",
    ring: "ring-purple-400",
    icon: <OthersIcon />,
  },
];

interface Props {
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function CategoryPicker({ selected, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);

  const handleSelect = (id: string) => {
    onSelect(selected === id ? null : id);
  };

  return (
    <div className="mt-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <span className="text-base font-semibold tracking-wide">Browse by Book</span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-orange-400 text-xs font-medium"
        >
          {expanded ? "Show Less" : "View All"}
        </button>
      </div>

      {/* Horizontal scroll (collapsed) */}
      {!expanded && (
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              active={selected === cat.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* Vertical grid (expanded) */}
      {expanded && (
        <div className="grid grid-cols-3 gap-3 px-4">
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              active={selected === cat.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  cat,
  active,
  onSelect,
}: {
  cat: Category;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(cat.id)}
      className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl w-[88px] border transition-all duration-200
        bg-gradient-to-b ${cat.gradient}
        ${active ? `ring-2 ${cat.ring} border-transparent` : "border-white/10"}
      `}
    >
      <div className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}>
        {cat.icon}
      </div>
      <span
        className={`text-[10px] leading-tight text-center font-medium transition-colors ${
          active ? "text-white" : "text-gray-300"
        }`}
      >
        {cat.label}
      </span>
    </button>
  );
}
