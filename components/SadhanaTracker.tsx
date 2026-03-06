"use client";

import { useCallback, useEffect, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import {
  getSadhanaQuestions,
  getMyEntries,
  submitSadhanaEntry,
  SadhanaQuestion,
  SadhanaEntryResponse,
} from "@/services/sadhana.service";

const CATEGORY_COLORS: Record<string, string> = {
  Nidra:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
  Japa:       "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Seva:       "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Study:      "bg-teal-500/15 text-teal-400 border-teal-500/30",
  Principles: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const SCORE_COLORS = [
  { min: 90, label: "Excellent",  color: "text-emerald-400", ring: "border-emerald-500/60" },
  { min: 70, label: "Very Good",  color: "text-teal-400",    ring: "border-teal-500/60"    },
  { min: 50, label: "Good",       color: "text-amber-400",   ring: "border-amber-500/60"   },
  { min: 0,  label: "Keep Going", color: "text-orange-400",  ring: "border-orange-500/60"  },
];

function getScoreGrade(score: number, max: number) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return SCORE_COLORS.find((s) => pct >= s.min) ?? SCORE_COLORS[SCORE_COLORS.length - 1];
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Already submitted screen ───────────────────────────────────────────────
function AlreadySubmitted({
  entry,
  questions,
  onReset,
}: {
  entry: SadhanaEntryResponse;
  questions: SadhanaQuestion[];
  onReset: () => void;
}) {
  const grade = getScoreGrade(entry.totalScore, entry.maxScore);
  const pct = entry.maxScore > 0 ? Math.round((entry.totalScore / entry.maxScore) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 py-6 gap-5">
      {/* Score card */}
      <div className={`rounded-2xl border-2 ${grade.ring} bg-gray-900/60 p-6 text-center`}>
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500 mb-1">
          {entry.entryDate === today() ? "Today's Score" : formatDate(entry.entryDate)}
        </p>
        <div className="flex items-baseline justify-center gap-1.5 mb-1">
          <span className={`text-5xl font-black ${grade.color}`}>{entry.totalScore}</span>
          <span className="text-2xl font-bold text-gray-600">/ {entry.maxScore}</span>
        </div>
        <span className={`text-sm font-semibold ${grade.color}`}>{grade.label}</span>
        {/* Progress bar */}
        <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">{formatDate(entry.entryDate)}</p>
      </div>

      {/* Answer summary */}
      <div className="rounded-2xl bg-gray-900/60 border border-gray-800 overflow-hidden">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-600 px-4 pt-4 pb-2">
          Summary
        </p>
        {questions.map((q) => {
          const val = entry.answers[q.slug];
          const opt = q.options.find((o) => o.value === val);
          if (!val) return null;
          return (
            <div key={q.slug} className="flex items-start justify-between px-4 py-3 border-t border-gray-800/70 gap-3">
              <span className="text-sm text-gray-400 flex-1 leading-snug">{q.title}</span>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-white">{opt?.label ?? val}</p>
                {opt && (
                  <p className="text-[10px] text-gray-600 font-medium">{opt.points} pts</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onReset}
        className="mt-auto w-full py-3 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-gray-200 hover:border-gray-500 transition-colors"
      >
        View questions again
      </button>
    </div>
  );
}

// ── Main tracker ───────────────────────────────────────────────────────────
export default function SadhanaTracker() {
  const fetchQuestions = useCallback(() => getSadhanaQuestions(), []);
  const { data: questions, loading, error: questionsError } = useFetch<SadhanaQuestion[]>(fetchQuestions);

  const [selectedDate, setSelectedDate] = useState(today());
  const [allEntries, setAllEntries] = useState<SadhanaEntryResponse[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0); // 0 = landing, 1..n = questions, n+1 = review
  const [submitted, setSubmitted] = useState(false);
  const [submittedEntry, setSubmittedEntry] = useState<SadhanaEntryResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showAlreadySubmitted, setShowAlreadySubmitted] = useState(false);

  // Fetch all entries on mount
  useEffect(() => {
    getMyEntries()
      .then((entries) => { setAllEntries(entries); setEntriesLoaded(true); })
      .catch(() => setEntriesLoaded(true));
  }, []);

  // Reset form when date changes
  useEffect(() => {
    setStep(0);
    setSubmitted(false);
    setSubmittedEntry(null);
    setShowAlreadySubmitted(false);
    setAnswers({});
    setSubmitError("");
  }, [selectedDate]);

  // Derived: entry for currently selected date
  const entryForDate = allEntries.find((e) => e.entryDate === selectedDate) ?? null;

  const visibleQuestions = (questions ?? []).filter((q) => q.active && !q.hidden);
  const totalSteps = visibleQuestions.length;
  const isReview = step === totalSteps + 1;
  const isLanding = step === 0;
  const currentQuestion = !isLanding && !isReview ? visibleQuestions[step - 1] : null;

  const handleOptionSelect = (slug: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [slug]: value }));
    // Auto-advance
    setTimeout(() => {
      setStep((s) => s + 1);
    }, 200);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const entry = await submitSadhanaEntry(selectedDate, answers);
      setAllEntries((prev) => [...prev.filter((e) => e.entryDate !== selectedDate), entry]);
      setSubmittedEntry(entry);
      setSubmitted(true);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) {
        // Already submitted — show the existing entry
        const existing = allEntries.find((e) => e.entryDate === selectedDate);
        if (existing) { setShowAlreadySubmitted(true); return; }
        setSubmitError("Already submitted for this date.");
      } else if (status === 401 || status === 403) {
        setSubmitError("Session expired. Please log in again.");
      } else {
        setSubmitError("Server error. Please wait a moment and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Score calculation for review/result
  const { totalScore, maxScore } = (() => {
    let total = 0, max = 0;
    (questions ?? []).filter((q) => q.active).forEach((q) => {
      if (!q.options.length) return;
      max += Math.max(...q.options.map((o) => o.points));
      const sel = answers[q.slug];
      if (sel) {
        const opt = q.options.find((o) => o.value === sel);
        if (opt) total += opt.points;
      }
    });
    return { totalScore: total, maxScore: max };
  })();

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading || !entriesLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error loading questions ──────────────────────────────────────────────
  if (questionsError || (!loading && questions === null)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-red-400 text-sm font-medium">Could not load questions</p>
        <p className="text-gray-600 text-xs">Please check your connection or try logging in again.</p>
      </div>
    );
  }

  // ── Already submitted for selected date ────────────────────────────────
  if (entryForDate && showAlreadySubmitted && !submitted) {
    return (
      <AlreadySubmitted
        entry={entryForDate}
        questions={visibleQuestions}
        onReset={() => setShowAlreadySubmitted(false)}
      />
    );
  }

  // ── Success screen ───────────────────────────────────────────────────────
  if (submitted && submittedEntry) {
    const grade = getScoreGrade(submittedEntry.totalScore, submittedEntry.maxScore);
    const pct = submittedEntry.maxScore > 0 ? Math.round((submittedEntry.totalScore / submittedEntry.maxScore) * 100) : 0;
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-orange-500/15 border-2 border-orange-500/50 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-orange-400">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="currentColor"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Offering Accepted!</h2>
          <p className="text-sm text-gray-500">Your daily sadhana has been recorded.</p>
        </div>
        <div className={`w-full rounded-2xl border-2 ${grade.ring} bg-gray-900/60 p-5`}>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1">Total Score</p>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className={`text-5xl font-black ${grade.color}`}>{submittedEntry.totalScore}</span>
            <span className="text-2xl font-bold text-gray-600">/ {submittedEntry.maxScore}</span>
          </div>
          <p className={`text-sm font-semibold mt-1 ${grade.color}`}>{grade.label} — {pct}%</p>
          <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
              style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Landing screen ───────────────────────────────────────────────────────
  if (isLanding) {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-orange-400">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} stroke="currentColor"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Daily Sadhana Card</h1>
          {/* Date picker */}
          <input
            type="date"
            value={selectedDate}
            max={today()}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="mt-2 bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-300 text-center outline-none focus:border-orange-500/60 transition-colors"
          />
        </div>

        <div className="rounded-2xl bg-gray-900/60 border border-gray-800 p-4 space-y-2.5">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-600">Today's Topics</p>
          {Object.entries(
            visibleQuestions.reduce<Record<string, number>>((acc, q) => {
              acc[q.category ?? "Other"] = (acc[q.category ?? "Other"] ?? 0) + 1;
              return acc;
            }, {})
          ).map(([cat, count]) => (
            <div key={cat} className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[cat] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
                {cat}
              </span>
              <span className="text-xs text-gray-600">{count} question{count > 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>

        {entryForDate ? (
          <button
            onClick={() => setShowAlreadySubmitted(true)}
            className="mt-auto w-full bg-gray-800 hover:bg-gray-700 active:scale-[0.98] text-white font-semibold py-4 rounded-2xl transition-all border border-gray-700"
          >
            View Submission for {selectedDate === today() ? "Today" : formatDate(selectedDate)}
          </button>
        ) : (
          <button
            onClick={() => setStep(1)}
            className="mt-auto w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-orange-900/30"
          >
            Begin Sadhana Card ✦
          </button>
        )}
      </div>
    );
  }

  // ── Question screen ──────────────────────────────────────────────────────
  if (currentQuestion) {
    const progress = ((step - 1) / totalSteps) * 100;
    const catStyle = CATEGORY_COLORS[currentQuestion.category ?? ""] ?? "bg-gray-800 text-gray-400 border-gray-700";
    const selected = answers[currentQuestion.slug];

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Progress bar + step */}
        <div className="flex-shrink-0 px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">{step} / {totalSteps}</span>
            {currentQuestion.category && (
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${catStyle}`}>
                {currentQuestion.category}
              </span>
            )}
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question + options */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Title */}
          <div>
            <h2 className="text-lg font-bold text-white leading-snug">
              {currentQuestion.title}
            </h2>
            {currentQuestion.description && (
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                {currentQuestion.description}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {currentQuestion.options.map((opt) => {
              const isSelected = selected === opt.value;
              const maxPts = Math.max(...currentQuestion.options.map((o) => o.points));
              const isTop = opt.points === maxPts;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleOptionSelect(currentQuestion.slug, opt.value)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
                    isSelected
                      ? "border-orange-500 bg-orange-500/15 text-white"
                      : "border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-600 hover:text-white"
                  }`}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {isTop && (
                      <span className="text-[9px] font-bold text-orange-400/70">BEST</span>
                    )}
                    <span className={`text-xs font-bold tabular-nums ${
                      isSelected ? "text-orange-400" : "text-gray-600"
                    }`}>
                      {opt.points}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? "border-orange-500 bg-orange-500" : "border-gray-700"
                    }`}>
                      {isSelected && (
                        <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
                            stroke="white" fill="none" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nav buttons */}
        <div className="flex-shrink-0 px-5 pb-4 pt-2 flex gap-2.5">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="px-5 py-3 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white hover:border-gray-500 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            {selected ? "Next →" : "Skip →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Review screen ────────────────────────────────────────────────────────
  if (isReview) {
    const grade = getScoreGrade(totalScore, maxScore);
    const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Score preview */}
          <div className={`rounded-2xl border-2 ${grade.ring} bg-gray-900/60 p-5 text-center`}>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1">
              Your Score
            </p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className={`text-5xl font-black ${grade.color}`}>{totalScore}</span>
              <span className="text-2xl font-bold text-gray-600">/ {maxScore}</span>
            </div>
            <p className={`text-sm font-semibold mt-1 ${grade.color}`}>{grade.label} — {pct}%</p>
            <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Answer summary */}
          <div className="rounded-2xl bg-gray-900/60 border border-gray-800 overflow-hidden">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-600 px-4 pt-4 pb-2">
              Review Answers
            </p>
            {visibleQuestions.map((q) => {
              const val = answers[q.slug];
              const opt = q.options.find((o) => o.value === val);
              return (
                <div key={q.slug}
                  className="flex items-start justify-between px-4 py-3 border-t border-gray-800/70 gap-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
                  onClick={() => setStep(visibleQuestions.indexOf(q) + 1)}
                >
                  <span className="text-sm text-gray-400 flex-1 leading-snug">{q.title}</span>
                  <div className="text-right flex-shrink-0">
                    {opt ? (
                      <>
                        <p className="text-sm font-semibold text-white">{opt.label}</p>
                        <p className="text-[10px] text-gray-600 font-medium">{opt.points} pts</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600 italic">Skipped</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit actions */}
        {submitError && (
          <p className="text-xs text-red-400 text-center px-5 pb-1">{submitError}</p>
        )}
        <div className="flex-shrink-0 px-5 pb-4 pt-2 flex gap-2.5">
          <button
            onClick={() => setStep(totalSteps)}
            className="px-5 py-3 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white hover:border-gray-500 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-lg shadow-orange-900/30"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </span>
            ) : "Submit Offering ✦"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
