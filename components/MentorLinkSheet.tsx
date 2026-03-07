"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/useT";
import {
  getMyMentors,
  linkMentor,
  unlinkMentor,
  getMentorQA,
  askMentorQuestion,
  uploadQAAudio,
  MentorUser,
  SadhanaQA,
} from "@/services/sadhana.service";
import AudioRecorder from "@/components/AudioRecorder";
import { searchUsersPublic, UserSearchResult } from "@/services/video.service";

function AvatarInitial({ name }: { name: string }) {
  const initial = name?.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-400 text-sm font-bold flex items-center justify-center flex-shrink-0">
      {initial}
    </div>
  );
}

function formatShort(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Q&A thread per mentor ──────────────────────────────────────────────────

function MentorQAThread({ mentor }: { mentor: MentorUser }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [thread, setThread] = useState<SadhanaQA[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);

  const handleToggle = () => {
    if (!expanded && thread === null) {
      setLoading(true);
      getMentorQA(mentor.id)
        .then(setThread)
        .catch(() => setThread([]))
        .finally(() => setLoading(false));
    }
    setExpanded((v) => !v);
  };

  const handleSend = async () => {
    if (!question.trim() && !audioBlob) return;
    setSending(true);
    try {
      let audioUrl: string | undefined;
      if (audioBlob) audioUrl = await uploadQAAudio(audioBlob);
      const qa = await askMentorQuestion(mentor.id, question.trim(), audioUrl);
      setThread((prev) => [qa, ...(prev ?? [])]);
      setQuestion("");
      setAudioBlob(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* Expand toggle */}
      <button
        onClick={handleToggle}
        className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-orange-400 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          strokeWidth={2} stroke="currentColor"
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
        {expanded ? t("mentor.hideMessages") : t("mentor.showMessages")}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Thread */}
          {loading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] text-gray-600">Loading…</span>
            </div>
          ) : thread && thread.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {thread.map((qa) => (
                <div key={qa.id} className="space-y-1">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-gray-800 rounded-xl rounded-tr-sm px-3 py-1.5">
                      {qa.question !== "(Voice message)" && (
                        <p className="text-[11px] text-gray-300">{qa.question}</p>
                      )}
                      {qa.questionAudioUrl && (
                        <audio controls src={qa.questionAudioUrl} className="mt-1 h-7 max-w-full" />
                      )}
                      <p className="text-[10px] text-gray-600 mt-0.5">{formatShort(qa.askedAt)}</p>
                    </div>
                  </div>
                  {qa.answer ? (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] bg-orange-500/10 border border-orange-500/20 rounded-xl rounded-tl-sm px-3 py-1.5">
                        {qa.answer !== "(Voice message)" && (
                          <p className="text-[11px] text-orange-100">{qa.answer}</p>
                        )}
                        {qa.answerAudioUrl && (
                          <audio controls src={qa.answerAudioUrl} className="mt-1 h-7 max-w-full" />
                        )}
                        {qa.answeredAt && (
                          <p className="text-[10px] text-orange-400/50 mt-0.5">{formatShort(qa.answeredAt)}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-600 pl-2 italic">Awaiting response…</p>
                  )}
                </div>
              ))}
            </div>
          ) : thread !== null ? (
            <p className="text-[11px] text-gray-600">{t("mentor.noMessages")}</p>
          ) : null}

          {/* Ask form */}
          <div className="space-y-1.5 pt-1">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={t("mentor.askPlaceholder")}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/60"
              />
              <AudioRecorder onAudio={setAudioBlob} />
              <button
                onClick={handleSend}
                disabled={sending || (!question.trim() && !audioBlob)}
                className="px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold hover:bg-orange-500/30 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {sending ? (
                  <span className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin inline-block" />
                ) : t("qa.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main sheet ─────────────────────────────────────────────────────────────

export default function MentorLinkSheet({
  onClose,
  onMentorsChanged,
}: {
  onClose: () => void;
  onMentorsChanged?: (mentors: MentorUser[]) => void;
}) {
  const t = useT();
  const [mentors, setMentors] = useState<MentorUser[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getMyMentors()
      .then(setMentors)
      .catch(() => setMentors([]))
      .finally(() => setLoadingMentors(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchUsersPublic(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const updateMentors = (updated: MentorUser[]) => {
    setMentors(updated);
    onMentorsChanged?.(updated);
  };

  const handleLink = async (user: UserSearchResult) => {
    setLinkingId(user.id);
    try {
      await linkMentor(user.id);
      const updated = mentors.some((m) => m.id === user.id)
        ? mentors
        : [...mentors, { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role }];
      updateMentors(updated);
    } finally {
      setLinkingId(null);
    }
  };

  const handleUnlink = async (mentorId: number) => {
    setUnlinkingId(mentorId);
    try {
      await unlinkMentor(mentorId);
      updateMentors(mentors.filter((m) => m.id !== mentorId));
    } finally {
      setUnlinkingId(null);
    }
  };

  const isLinked = (id: number) => mentors.some((m) => m.id === id);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto bg-[#111] rounded-t-2xl border-t border-gray-800 flex flex-col max-h-[85vh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Title */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <h2 className="text-base font-bold text-white">{t("mentor.title")}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          {/* Current mentors */}
          <div>
            {loadingMentors ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">{t("common.loading")}</span>
              </div>
            ) : mentors.length === 0 ? (
              <p className="text-xs text-gray-600 py-1">{t("mentor.noMentors")}</p>
            ) : (
              <div className="space-y-3">
                {mentors.map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                    <div className="flex items-center gap-3">
                      <AvatarInitial name={m.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{m.email}</p>
                      </div>
                      {confirmUnlinkId === m.id ? (
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <button
                            onClick={() => { setConfirmUnlinkId(null); handleUnlink(m.id); }}
                            disabled={unlinkingId === m.id}
                            className="text-[11px] font-semibold text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                          >
                            {unlinkingId === m.id ? "…" : t("mentor.confirm")}
                          </button>
                          <button
                            onClick={() => setConfirmUnlinkId(null)}
                            className="text-[11px] font-semibold text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {t("mentor.cancel")}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmUnlinkId(m.id)}
                          className="flex-shrink-0 text-[11px] font-semibold text-gray-500 hover:text-red-400 transition-colors"
                        >
                          {t("mentor.unlink")}
                        </button>
                      )}
                    </div>
                    {confirmUnlinkId === m.id && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                          strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <p className="text-[11px] text-red-300 leading-relaxed">
                          <span className="font-semibold">{m.name}</span> {t("mentor.unlinkWarning")}
                        </p>
                      </div>
                    )}
                    <MentorQAThread mentor={m} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-800" />

          {/* Search */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t("mentor.searchAdd")}</p>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={2} stroke="currentColor"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder={t("mentor.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/60"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {results.length > 0 && (
              <div className="mt-2 space-y-2">
                {results.map((user) => {
                  const linked = isLinked(user.id);
                  return (
                    <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
                      <AvatarInitial name={user.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                      </div>
                      {linked ? (
                        <span className="flex-shrink-0 text-[11px] font-semibold text-emerald-400">{t("mentor.linked")}</span>
                      ) : (
                        <button
                          onClick={() => handleLink(user)}
                          disabled={linkingId === user.id}
                          className="flex-shrink-0 px-3 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-semibold hover:bg-orange-500/30 disabled:opacity-50 transition-colors"
                        >
                          {linkingId === user.id ? "…" : t("mentor.link")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {query.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="text-xs text-gray-600 mt-3 text-center">{t("mentor.noUsers")}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
