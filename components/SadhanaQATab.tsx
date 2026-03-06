"use client";

import { useEffect, useState } from "react";
import {
  getMyMentors,
  getMentorQA,
  askMentorQuestion,
  uploadQAAudio,
  MentorUser,
  SadhanaQA,
} from "@/services/sadhana.service";
import AudioRecorder from "@/components/AudioRecorder";

function formatShort(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

// ── Single QA item ─────────────────────────────────────────────────────────

function QAItem({ qa, mentorName }: { qa: SadhanaQA; mentorName?: string }) {
  return (
    <div className="space-y-1.5">
      {mentorName && (
        <p className="text-[10px] font-semibold text-orange-400/70 uppercase tracking-wider">{mentorName}</p>
      )}
      {/* Question bubble — right aligned */}
      <div className="flex justify-end">
        <div className="max-w-[88%] bg-gray-800 rounded-2xl rounded-tr-sm px-3.5 py-2.5">
          {qa.question !== "(Voice message)" && (
            <p className="text-[13px] text-gray-200 leading-relaxed">{qa.question}</p>
          )}
          {qa.questionAudioUrl && (
            <audio controls src={qa.questionAudioUrl} className="mt-1 h-8 max-w-full" />
          )}
          <p className="text-[10px] text-gray-600 mt-0.5 text-right">{formatShort(qa.askedAt)}</p>
        </div>
      </div>
      {/* Answer bubble — left aligned */}
      {qa.answer ? (
        <div className="flex justify-start">
          <div className="max-w-[88%] bg-orange-500/10 border border-orange-500/20 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
            {qa.answer !== "(Voice message)" && (
              <p className="text-[13px] text-orange-100 leading-relaxed">{qa.answer}</p>
            )}
            {qa.answerAudioUrl && (
              <audio controls src={qa.answerAudioUrl} className="mt-1 h-8 max-w-full" />
            )}
            {qa.answeredAt && (
              <p className="text-[10px] text-orange-400/50 mt-0.5">{formatShort(qa.answeredAt)}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-gray-600 pl-3 italic">Awaiting response…</p>
      )}
    </div>
  );
}

// ── Ask form (inline at bottom of each mentor section) ─────────────────────

function AskForm({
  mentorId,
  mentorName,
  onSent,
}: {
  mentorId: number;
  mentorName: string;
  onSent: (qa: SadhanaQA) => void;
}) {
  const [question, setQuestion] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!question.trim() && !audioBlob) return;
    setSending(true);
    try {
      let audioUrl: string | undefined;
      if (audioBlob) audioUrl = await uploadQAAudio(audioBlob);
      const qa = await askMentorQuestion(mentorId, question.trim(), audioUrl);
      onSent(qa);
      setQuestion("");
      setAudioBlob(null);
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Ask ${mentorName}…`}
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 focus:border-orange-500/60 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none resize-none transition-colors"
          />
          {sent && (
            <span className="absolute right-3 top-2 text-[11px] text-emerald-400 font-semibold">Sent ✓</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 mb-0.5">
          <AudioRecorder onAudio={setAudioBlob} />
          <button
            onClick={handleSend}
            disabled={sending || (!question.trim() && !audioBlob)}
            className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold transition-all active:scale-95"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            ) : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SadhanaQATab({ onAnswersSeen }: { onAnswersSeen?: () => void }) {
  const [mentors, setMentors] = useState<MentorUser[]>([]);
  const [threads, setThreads] = useState<Record<number, SadhanaQA[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyMentors()
      .then(async (fetched) => {
        if (cancelled) return;
        setMentors(fetched);
        // Load all threads in parallel (also marks answers as seen on backend)
        const map: Record<number, SadhanaQA[]> = {};
        await Promise.all(
          fetched.map(async (m) => {
            try { map[m.id] = await getMentorQA(m.id); }
            catch { map[m.id] = []; }
          })
        );
        if (!cancelled) {
          setThreads(map);
          onAnswersSeen?.();
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const addQA = (mentorId: number, qa: SadhanaQA) => {
    setThreads((prev) => ({ ...prev, [mentorId]: [qa, ...(prev[mentorId] ?? [])] }));
  };

  // Search across all loaded Q&A
  const trimSearch = search.trim().toLowerCase();
  const searchResults: (SadhanaQA & { mentorName: string })[] = trimSearch
    ? mentors.flatMap((m) =>
        (threads[m.id] ?? [])
          .filter(
            (qa) =>
              qa.question.toLowerCase().includes(trimSearch) ||
              (qa.answer && qa.answer.toLowerCase().includes(trimSearch))
          )
          .map((qa) => ({ ...qa, mentorName: m.name }))
      )
    : [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mentors.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400">No mentors linked yet.</p>
        <p className="text-xs text-gray-600">Tap the people icon in the header to link a mentor.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search bar */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions &amp; answers…"
            className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-600 hover:text-gray-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Search results */}
        {trimSearch ? (
          searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-gray-500">No results for "{search}"</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <p className="text-[11px] text-gray-600">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</p>
              {searchResults.map((qa) => (
                <div key={qa.id} className="rounded-2xl bg-gray-900/60 border border-gray-800 p-3">
                  <QAItem qa={qa} mentorName={qa.mentorName} />
                </div>
              ))}
            </div>
          )
        ) : (
          /* Normal view — grouped by mentor */
          <div className="space-y-5 pt-1">
            {mentors.map((mentor) => {
              const thread = threads[mentor.id] ?? [];
              return (
                <div key={mentor.id} className="rounded-2xl bg-gray-900/60 border border-gray-800 overflow-hidden">
                  {/* Mentor header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 text-sm font-bold flex items-center justify-center flex-shrink-0">
                      {mentor.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{mentor.name}</p>
                      <p className="text-[11px] text-gray-600 truncate">{mentor.email}</p>
                    </div>
                    <span className="text-[11px] text-gray-600">{thread.length} message{thread.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Thread */}
                  <div className="px-4 pt-3 pb-1 space-y-4">
                    {thread.length === 0 ? (
                      <p className="text-[12px] text-gray-600 text-center py-2">No messages yet. Ask your first question!</p>
                    ) : (
                      thread.map((qa) => <QAItem key={qa.id} qa={qa} />)
                    )}
                  </div>

                  {/* Ask form */}
                  <div className="px-4 pb-4">
                    <AskForm
                      mentorId={mentor.id}
                      mentorName={mentor.name.split(" ")[0]}
                      onSent={(qa) => addQA(mentor.id, qa)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
