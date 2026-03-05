"use client";

import { useCallback, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import {
  getMyEntries,
  getSadhanaQuestions,
  SadhanaEntryResponse,
  SadhanaQuestion,
} from "@/services/sadhana.service";

const SCORE_COLORS = [
  { min: 90, label: "Excellent",  color: "text-emerald-400", dot: "bg-emerald-400" },
  { min: 70, label: "Very Good",  color: "text-teal-400",    dot: "bg-teal-400"    },
  { min: 50, label: "Good",       color: "text-amber-400",   dot: "bg-amber-400"   },
  { min: 0,  label: "Keep Going", color: "text-orange-400",  dot: "bg-orange-400"  },
];

function getGrade(score: number, max: number) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return SCORE_COLORS.find((s) => pct >= s.min) ?? SCORE_COLORS[SCORE_COLORS.length - 1];
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function AnswerBreakdown({
  entry,
  questions,
}: {
  entry: SadhanaEntryResponse;
  questions: SadhanaQuestion[];
}) {
  return (
    <div className="mt-3 rounded-xl bg-black/40 border border-gray-800 overflow-hidden">
      {questions.map((q) => {
        const val = entry.answers[q.slug];
        const opt = q.options.find((o) => o.value === val);
        if (!val) return null;
        return (
          <div key={q.slug} className="flex items-start justify-between px-4 py-2.5 border-b border-gray-800/60 last:border-0 gap-3">
            <span className="text-xs text-gray-400 flex-1 leading-snug">{q.title}</span>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-semibold text-white">{opt?.label ?? val}</p>
              {opt && <p className="text-[10px] text-gray-600">{opt.points} pts</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SadhanaHistory() {
  const fetchEntries = useCallback(() => getMyEntries(), []);
  const fetchQuestions = useCallback(() => getSadhanaQuestions(), []);
  const { data: entries, loading: entriesLoading } = useFetch<SadhanaEntryResponse[]>(fetchEntries);
  const { data: questions } = useFetch<SadhanaQuestion[]>(fetchQuestions);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (entriesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400">No records yet.</p>
        <p className="text-xs text-gray-600">Complete your first sadhana card!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {entries.map((entry) => {
        const grade = getGrade(entry.totalScore, entry.maxScore);
        const pct = entry.maxScore > 0 ? Math.round((entry.totalScore / entry.maxScore) * 100) : 0;
        const isOpen = expandedId === entry.id;

        return (
          <div key={entry.id} className="rounded-2xl bg-gray-900/70 border border-gray-800 overflow-hidden">
            <button
              className="w-full text-left px-4 py-3.5 flex items-center gap-3"
              onClick={() => setExpandedId(isOpen ? null : entry.id)}
            >
              {/* Date */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{formatDate(entry.entryDate)}</p>
                {/* Score bar */}
                <div className="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden w-full">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {/* Score badge */}
              <div className="text-right flex-shrink-0">
                <p className={`text-base font-black ${grade.color}`}>
                  {entry.totalScore}
                  <span className="text-xs font-normal text-gray-600">/{entry.maxScore}</span>
                </p>
                <p className={`text-[10px] font-semibold ${grade.color}`}>{grade.label}</p>
              </div>
              {/* Chevron */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={2} stroke="currentColor"
                className={`w-4 h-4 flex-shrink-0 text-gray-600 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {isOpen && questions && (
              <div className="px-4 pb-4">
                <AnswerBreakdown entry={entry} questions={questions} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
