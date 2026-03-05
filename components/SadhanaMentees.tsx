"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getMyMentees,
  getMenteeEntries,
  getSadhanaQuestions,
  MentorUser,
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
    day: "numeric", month: "short",
  });
}

function AvatarInitial({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initial = name?.trim()[0]?.toUpperCase() ?? "?";
  const cls = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${cls} rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center flex-shrink-0`}>
      {initial}
    </div>
  );
}

// ── Expanded devotee card ──────────────────────────────────────────────────

type ViewMode = "date" | "question";

function DevoteeDetail({
  entries,
  questions,
}: {
  entries: SadhanaEntryResponse[];
  questions: SadhanaQuestion[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("date");
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [activeQuestionSlug, setActiveQuestionSlug] = useState<string | null>(
    questions[0]?.slug ?? null
  );

  if (entries.length === 0) {
    return <p className="text-xs text-gray-600 py-2">No data available</p>;
  }

  return (
    <div>
      {/* Toggle */}
      <div className="flex gap-1 mb-3">
        {(["date", "question"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === mode
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-gray-800/60 text-gray-500 border border-gray-800"
            }`}
          >
            {mode === "date" ? "Date View" : "By Question"}
          </button>
        ))}
      </div>

      {viewMode === "date" ? (
        <div className="space-y-1.5">
          {entries.map((entry) => {
            const grade = getGrade(entry.totalScore, entry.maxScore);
            const pct = entry.maxScore > 0 ? Math.round((entry.totalScore / entry.maxScore) * 100) : 0;
            return (
              <div key={entry.id}>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800/50 hover:bg-gray-800/80 transition-colors text-left"
                  onClick={() =>
                    setSelectedEntryId(selectedEntryId === entry.id ? null : entry.id)
                  }
                >
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">{formatDate(entry.entryDate)}</span>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${grade.color} w-14 text-right flex-shrink-0`}>
                    {entry.totalScore}/{entry.maxScore}
                  </span>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${grade.dot}`} />
                </button>

                {/* Answer breakdown bottom sheet inline */}
                {selectedEntryId === entry.id && (
                  <div className="mt-1 mb-2 rounded-xl bg-black/40 border border-gray-800 overflow-hidden">
                    {questions.map((q) => {
                      const val = entry.answers[q.slug];
                      const opt = q.options.find((o) => o.value === val);
                      if (!val) return null;
                      return (
                        <div key={q.slug} className="flex items-start justify-between px-3 py-2 border-b border-gray-800/60 last:border-0 gap-2">
                          <span className="text-[11px] text-gray-400 flex-1 leading-snug">{q.title}</span>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[11px] font-semibold text-white">{opt?.label ?? val}</p>
                            {opt && <p className="text-[10px] text-gray-600">{opt.points} pts</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {/* Question chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
            {questions.map((q) => (
              <button
                key={q.slug}
                onClick={() => setActiveQuestionSlug(q.slug)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  activeQuestionSlug === q.slug
                    ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                    : "bg-gray-800/60 text-gray-500 border-gray-800"
                }`}
              >
                {q.title.length > 20 ? q.title.slice(0, 20) + "…" : q.title}
              </button>
            ))}
          </div>

          {/* Answers for active question */}
          {activeQuestionSlug && (
            <div className="space-y-1.5">
              {entries.map((entry) => {
                const val = entry.answers[activeQuestionSlug];
                const q = questions.find((q) => q.slug === activeQuestionSlug);
                const opt = q?.options.find((o) => o.value === val);
                return (
                  <div key={entry.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/50">
                    <span className="text-[11px] text-gray-500 w-16 flex-shrink-0">{formatDate(entry.entryDate)}</span>
                    <span className="text-[11px] text-white flex-1">{opt?.label ?? val ?? "—"}</span>
                    {opt && <span className="text-[10px] text-gray-600 flex-shrink-0">{opt.points} pts</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Devotee card ──────────────────────────────────────────────────────────

function DevoteeCard({
  devotee,
  questions,
}: {
  devotee: MentorUser;
  questions: SadhanaQuestion[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<SadhanaEntryResponse[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadEntries = async () => {
    if (entries !== null) return;
    setLoading(true);
    try {
      const data = await getMenteeEntries(devotee.id);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!expanded) loadEntries();
    setExpanded((v) => !v);
  };

  return (
    <div className="rounded-2xl bg-gray-900/70 border border-gray-800 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={handleToggle}
      >
        <AvatarInitial name={devotee.name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{devotee.name}</p>
          <p className="text-[11px] text-gray-500 truncate">{devotee.email}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          strokeWidth={2} stroke="currentColor"
          className={`w-4 h-4 text-gray-600 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800/60">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries !== null ? (
            <div className="mt-3">
              <DevoteeDetail entries={entries} questions={questions} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function SadhanaMentees() {
  const [mentees, setMentees] = useState<MentorUser[] | null>(null);
  const [questions, setQuestions] = useState<SadhanaQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyMentees(), getSadhanaQuestions()])
      .then(([m, q]) => {
        setMentees(m);
        setQuestions(q.filter((q) => q.active && !q.hidden));
      })
      .catch(() => setMentees([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!mentees || mentees.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400">No devotees have linked you as their mentor yet.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {mentees.map((devotee) => (
        <DevoteeCard key={devotee.id} devotee={devotee} questions={questions} />
      ))}
    </div>
  );
}
