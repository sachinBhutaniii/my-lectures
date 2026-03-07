"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getMyMentees,
  getMenteeEntries,
  getMenteeQA,
  getMenteePendingCounts,
  getSadhanaQuestions,
  getAbsentMentees,
  getEntryReactions,
  postEntryReaction,
  deleteEntryReaction,
  answerQuestion,
  uploadQAAudio,
  MentorUser,
  SadhanaEntryResponse,
  SadhanaQuestion,
  EntryReaction,
  SadhanaQA,
} from "@/services/sadhana.service";
import AudioRecorder from "@/components/AudioRecorder";

const SCORE_COLORS = [
  { min: 90, label: "Excellent",  color: "text-emerald-400", dot: "bg-emerald-400" },
  { min: 70, label: "Very Good",  color: "text-teal-400",    dot: "bg-teal-400"    },
  { min: 50, label: "Good",       color: "text-amber-400",   dot: "bg-amber-400"   },
  { min: 0,  label: "Keep Going", color: "text-orange-400",  dot: "bg-orange-400"  },
];

const REACTION_EMOJIS = ["🙏", "❤️", "👍", "⭐", "🔥"];

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

// ── Absent checker ─────────────────────────────────────────────────────────

function AbsentChecker() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultDate = yesterday.toISOString().split("T")[0];

  const [date, setDate] = useState(defaultDate);
  const [result, setResult] = useState<MentorUser[] | null>(null);
  const [allSubmitted, setAllSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    setResult(null);
    setAllSubmitted(false);
    try {
      const absent = await getAbsentMentees(date);
      if (absent.length === 0) setAllSubmitted(true);
      else setResult(absent);
    } catch {
      setResult([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl bg-gray-900/60 border border-gray-800 p-3">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Absent Check</p>
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setResult(null); setAllSubmitted(false); }}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500/60"
        />
        <button
          onClick={handleCheck}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold hover:bg-orange-500/30 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin inline-block" />
          ) : "Check"}
        </button>
      </div>

      {allSubmitted && (
        <p className="mt-2 text-xs text-emerald-400 font-semibold">All submitted ✓</p>
      )}
      {result !== null && result.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-orange-400 font-semibold mb-1">{result.length} absent:</p>
          <div className="flex flex-wrap gap-1.5">
            {result.map((u) => (
              <span key={u.id} className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 text-[11px] border border-orange-500/20">
                {u.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Entry reactions (mentor side) ─────────────────────────────────────────

function EntryReactionSection({
  devoteeId,
  entryId,
  myUserId,
}: {
  devoteeId: number;
  entryId: number;
  myUserId: number;
}) {
  const [reactions, setReactions] = useState<EntryReaction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getEntryReactions(entryId)
      .then(setReactions)
      .catch(() => setReactions([]))
      .finally(() => setLoading(false));
  }, [entryId]);

  const myReaction = reactions?.find((r) => r.mentorId === myUserId) ?? null;

  const handleSubmit = async () => {
    if (!emoji && !message.trim()) return;
    setSubmitting(true);
    try {
      const r = await postEntryReaction(devoteeId, entryId, { reaction: emoji || undefined, message: message.trim() || undefined });
      setReactions((prev) => {
        if (!prev) return [r];
        return [...prev.filter((x) => x.mentorId !== myUserId), r];
      });
      setShowForm(false);
      setEmoji("");
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deleteEntryReaction(devoteeId, entryId);
      setReactions((prev) => prev?.filter((r) => r.mentorId !== myUserId) ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-800/60">
      {myReaction ? (
        <div className="flex items-start gap-2">
          <div className="flex-1 flex items-center gap-1.5 flex-wrap">
            {myReaction.reaction && (
              <span className="text-base">{myReaction.reaction}</span>
            )}
            {myReaction.message && (
              <span className="text-[11px] text-gray-300">{myReaction.message}</span>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => { setEmoji(myReaction.reaction ?? ""); setMessage(myReaction.message ?? ""); setShowForm(true); }}
              className="text-[10px] text-gray-500 hover:text-orange-400 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="text-[10px] text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {submitting ? "…" : "Delete"}
            </button>
          </div>
        </div>
      ) : !showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="text-[11px] text-gray-600 hover:text-orange-400 transition-colors"
        >
          + Add reaction
        </button>
      ) : null}

      {showForm && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(emoji === e ? "" : e)}
                className={`text-lg p-1 rounded-lg transition-colors ${emoji === e ? "bg-orange-500/20 ring-1 ring-orange-500/40" : "hover:bg-gray-800"}`}
              >
                {e}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message (optional)…"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/60 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || (!emoji && !message.trim())}
              className="px-4 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold hover:bg-orange-500/30 disabled:opacity-50 transition-colors"
            >
              {submitting ? "…" : "Submit"}
            </button>
            <button
              onClick={() => { setShowForm(false); setEmoji(""); setMessage(""); }}
              className="px-4 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs font-semibold hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Messages view (Q&A thread, mentor answers) ────────────────────────────

function MessagesView({ devoteeId }: { devoteeId: number }) {
  const [thread, setThread] = useState<SadhanaQA[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [audioBlobs, setAudioBlobs] = useState<Record<number, Blob | null>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    getMenteeQA(devoteeId)
      .then(setThread)
      .catch(() => setThread([]))
      .finally(() => setLoading(false));
  }, [devoteeId]);

  const handleAnswer = async (qa: SadhanaQA) => {
    const ans = drafts[qa.id]?.trim() ?? "";
    const blob = audioBlobs[qa.id] ?? null;
    if (!ans && !blob) return;
    setSubmitting(qa.id);
    try {
      let audioUrl: string | undefined;
      if (blob) audioUrl = await uploadQAAudio(blob);
      const updated = await answerQuestion(qa.id, ans, audioUrl);
      setThread((prev) => prev?.map((q) => (q.id === qa.id ? updated : q)) ?? []);
      setDrafts((d) => { const nd = { ...d }; delete nd[qa.id]; return nd; });
      setAudioBlobs((d) => { const nd = { ...d }; delete nd[qa.id]; return nd; });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!thread || thread.length === 0) {
    return <p className="text-[11px] text-gray-600 py-4 text-center">No questions yet.</p>;
  }

  return (
    <div className="space-y-3">
      {thread.map((qa) => (
        <div key={qa.id} className="space-y-1.5">
          {/* Question bubble */}
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-gray-800 rounded-2xl rounded-tr-sm px-3 py-2">
              {qa.question !== "(Voice message)" && (
                <p className="text-xs text-gray-300">{qa.question}</p>
              )}
              {qa.questionAudioUrl && (
                <audio controls src={qa.questionAudioUrl} className="mt-1 h-8 max-w-full" />
              )}
              <p className="text-[10px] text-gray-600 mt-0.5">
                {new Date(qa.askedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
          {/* Answer bubble or answer form */}
          {qa.answer ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-orange-500/15 border border-orange-500/20 rounded-2xl rounded-tl-sm px-3 py-2">
                {qa.answer !== "(Voice message)" && (
                  <p className="text-xs text-orange-100">{qa.answer}</p>
                )}
                {qa.answerAudioUrl && (
                  <audio controls src={qa.answerAudioUrl} className="mt-1 h-8 max-w-full" />
                )}
                {qa.answeredAt && (
                  <p className="text-[10px] text-orange-400/60 mt-0.5">
                    {new Date(qa.answeredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={drafts[qa.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [qa.id]: e.target.value }))}
                placeholder="Write answer…"
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/60 resize-none"
              />
              <div className="flex gap-2 items-center">
                <AudioRecorder onAudio={(blob) => setAudioBlobs((d) => ({ ...d, [qa.id]: blob }))} />
                <button
                  onClick={() => handleAnswer(qa)}
                  disabled={submitting === qa.id || (!drafts[qa.id]?.trim() && !audioBlobs[qa.id])}
                  className="px-4 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold hover:bg-orange-500/30 disabled:opacity-50 transition-colors"
                >
                  {submitting === qa.id ? (
                    <span className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin inline-block" />
                  ) : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Expanded devotee card ──────────────────────────────────────────────────

type ViewMode = "date" | "question" | "messages";

function DevoteeDetail({
  devoteeId,
  entries,
  questions,
  myUserId,
  onMessagesSeen,
}: {
  devoteeId: number;
  entries: SadhanaEntryResponse[];
  questions: SadhanaQuestion[];
  myUserId: number;
  onMessagesSeen?: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("date");
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [activeQuestionSlug, setActiveQuestionSlug] = useState<string | null>(
    questions[0]?.slug ?? null
  );

  return (
    <div>
      {/* Toggle */}
      <div className="flex gap-1 mb-3">
        {(["date", "question", "messages"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => { setViewMode(mode); if (mode === "messages") onMessagesSeen?.(); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === mode
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-gray-800/60 text-gray-500 border border-gray-800"
            }`}
          >
            {mode === "date" ? "Date View" : mode === "question" ? "By Question" : "Messages"}
          </button>
        ))}
      </div>

      {viewMode === "messages" ? (
        <MessagesView devoteeId={devoteeId} />
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-600 py-4 text-center">No data available</p>
      ) : viewMode === "date" ? (
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

                {selectedEntryId === entry.id && (
                  <div className="mt-1 mb-2 rounded-xl bg-black/40 border border-gray-800 overflow-hidden px-1 pb-2">
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
                    <div className="px-3">
                      <EntryReactionSection
                        devoteeId={devoteeId}
                        entryId={entry.id}
                        myUserId={myUserId}
                      />
                    </div>
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
  myUserId,
  pendingCount,
}: {
  devotee: MentorUser;
  questions: SadhanaQuestion[];
  myUserId: number;
  pendingCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<SadhanaEntryResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [localPending, setLocalPending] = useState(pendingCount);

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
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{devotee.name}</p>
            {localPending > 0 && (
              <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {localPending}
              </span>
            )}
          </div>
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
              <DevoteeDetail
                devoteeId={devotee.id}
                entries={entries}
                questions={questions}
                myUserId={myUserId}
                onMessagesSeen={() => setLocalPending(0)}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function SadhanaMentees() {
  const { user } = useAuth();
  const [mentees, setMentees] = useState<MentorUser[] | null>(null);
  const [questions, setQuestions] = useState<SadhanaQuestion[]>([]);
  const [pendingCounts, setPendingCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyMentees(), getSadhanaQuestions(), getMenteePendingCounts()])
      .then(([m, q, counts]) => {
        setMentees(m);
        setQuestions(q.filter((q) => q.active && !q.hidden));
        setPendingCounts(counts);
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
    <div className="flex-1 overflow-y-auto">
      <AbsentChecker />
      <div className="px-4 py-3 space-y-3">
        {mentees.map((devotee) => (
          <DevoteeCard
            key={devotee.id}
            devotee={devotee}
            questions={questions}
            myUserId={user?.id ?? 0}
            pendingCount={pendingCounts[devotee.id] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
