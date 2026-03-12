"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/context/AuthContext";
import type { TranslationKey } from "@/lib/translations";
import SadhanaStreakCalendar from "@/components/SadhanaStreakCalendar";

const GRADE_LABELS: Record<string, TranslationKey> = {
  "Excellent":  "grade.excellent",
  "Very Good":  "grade.veryGood",
  "Good":       "grade.good",
  "Keep Going": "grade.keepGoing",
};
import {
  getMyEntries,
  getSadhanaQuestions,
  getEntryReactions,
  SadhanaEntryResponse,
  SadhanaQuestion,
  EntryReaction,
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

// ── Answer breakdown ───────────────────────────────────────────────────────

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

// ── Mentor reactions display ───────────────────────────────────────────────

function MentorReactionsSection({ entryId }: { entryId: number }) {
  const [reactions, setReactions] = useState<EntryReaction[] | null>(null);

  useEffect(() => {
    getEntryReactions(entryId)
      .then(setReactions)
      .catch(() => setReactions([]));
  }, [entryId]);

  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {reactions.map((r) => (
        <div key={r.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-orange-500/5 border border-orange-500/10">
          <span className="text-[11px] font-semibold text-orange-400 flex-shrink-0">{r.mentorName}</span>
          {r.reaction && <span className="text-base leading-none">{r.reaction}</span>}
          {r.message && <span className="text-[11px] text-gray-300 flex-1">{r.message}</span>}
        </div>
      ))}
    </div>
  );
}


// ── Main component ────────────────────────────────────────────────────────

export default function SadhanaHistory() {
  const t = useT();
  const { user } = useAuth();
  const fetchEntries = useCallback(() => getMyEntries(), []);
  const fetchQuestions = useCallback(() => getSadhanaQuestions(), []);
  const { data: entries, loading: entriesLoading } = useFetch<SadhanaEntryResponse[]>(fetchEntries);
  const { data: questions } = useFetch<SadhanaQuestion[]>(fetchQuestions);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Effective join date: from auth (new users) or earliest entry (pre-existing users), else today
  const joinedAt = useMemo(() => {
    if (user?.joinedAt) return user.joinedAt;
    if (entries && entries.length > 0) {
      return entries.reduce(
        (min, e) => (e.entryDate < min ? e.entryDate : min),
        entries[0].entryDate
      );
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [user?.joinedAt, entries]);

  if (entriesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <SadhanaStreakCalendar entries={[]} joinedAt={joinedAt} />
        <div className="h-px bg-gray-800 mx-4 mb-3" />
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-gray-600">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">{t("history.noRecords")}</p>
          <p className="text-xs text-gray-600">{t("history.completeFirst")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Streak calendar */}
      <SadhanaStreakCalendar entries={entries} joinedAt={joinedAt} />

      {/* Divider */}
      <div className="h-px bg-gray-800 mx-4 mb-3" />

      {/* Entry list */}
      <div className="px-4 pb-3 space-y-3">
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
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{formatDate(entry.entryDate)}</p>
                <div className="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden w-full">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-base font-black ${grade.color}`}>
                  {entry.totalScore}
                  <span className="text-xs font-normal text-gray-600">/{entry.maxScore}</span>
                </p>
                <p className={`text-[10px] font-semibold ${grade.color}`}>{t(GRADE_LABELS[grade.label] ?? "grade.keepGoing")}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={2} stroke="currentColor"
                className={`w-4 h-4 flex-shrink-0 text-gray-600 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {isOpen && questions && (
              <div className="px-4 pb-4">
                <AnswerBreakdown entry={entry} questions={questions} />

                {/* Mentor reactions */}
                <MentorReactionsSection entryId={entry.id} />
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
