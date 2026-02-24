"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { getMyAssignments, TranscriptReviewItem } from "@/services/video.service";
import Link from "next/link";

export default function ProofreadPage() {
  const { user, authLoading, isProofreader } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isProofreader) router.replace("/");
  }, [user, authLoading, isProofreader, router]);

  const fetchFn = useCallback(() => getMyAssignments(), []);
  const { data: items, loading } = useFetch<TranscriptReviewItem[]>(fetchFn);

  if (authLoading || !isProofreader) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allItems = items ?? [];

  // Pending: assigned but not yet submitted
  const level1Items = allItems.filter(
    (t) => t.level1ProofreaderId != null && t.approvalStatus === "DRAFT" && !t.l1ReviewSubmitted
  );
  const level2Items = allItems.filter(
    (t) => t.level2ProofreaderId != null && !t.l2ReviewSubmitted && t.approvalStatus !== "APPROVED"
  );

  // History: items where this user submitted their review
  // An item can appear once for L1 and once for L2 if assigned both, so we build separate entries
  type HistoryEntry = { item: TranscriptReviewItem; level: 1 | 2 };
  const historyEntries: HistoryEntry[] = [];

  if (user) {
    for (const t of allItems) {
      if (t.level1ProofreaderId === user.id && t.l1ReviewSubmitted) {
        historyEntries.push({ item: t, level: 1 });
      }
      // Only push L2 once even if same person holds both assignments
      if (t.level2ProofreaderId === user.id && t.l2ReviewSubmitted) {
        historyEntries.push({ item: t, level: 2 });
      }
    }
  }

  const pendingCount = level1Items.length + level2Items.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-gray-800">
        <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 text-blue-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </span>
          <h1 className="text-white font-bold text-lg">Proofreading</h1>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 border border-blue-400/30 text-blue-300">
            {user?.name}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-5 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Pending assignments ── */}
            {pendingCount === 0 && historyEntries.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                <p className="text-sm">No transcripts assigned to you yet.</p>
                <p className="text-xs mt-1 text-gray-700">An admin will assign transcripts for review.</p>
              </div>
            ) : (
              <>
                {/* Pending section header — only when there are pending items */}
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Review</h2>
                    <span className="text-xs text-gray-600">({pendingCount})</span>
                  </div>
                )}

                {/* Level 1 pending */}
                {level1Items.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[10px] font-bold text-blue-400">1</span>
                      <h2 className="text-sm font-semibold text-gray-300">Level 1 Review</h2>
                      <span className="text-xs text-gray-600">({level1Items.length})</span>
                    </div>
                    <div className="space-y-2">
                      {level1Items.map((item) => (
                        <AssignmentCard key={`l1-${item.id}`} item={item} level={1} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Level 2 pending */}
                {level2Items.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px] font-bold text-purple-400">2</span>
                      <h2 className="text-sm font-semibold text-gray-300">Level 2 Review</h2>
                      <span className="text-xs text-gray-600">({level2Items.length})</span>
                    </div>
                    <div className="space-y-2">
                      {level2Items.map((item) => (
                        <AssignmentCard key={`l2-${item.id}`} item={item} level={2} />
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Contribution history ── */}
                {historyEntries.length > 0 && (
                  <section className="space-y-3 pt-2">
                    {/* Divider */}
                    <div className="border-t border-gray-800" />

                    {/* Section header */}
                    <div className="flex items-center gap-2 pt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-emerald-400 flex-shrink-0">
                        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.307 4.491 4.491 0 0 1-1.307-3.496A4.49 4.49 0 0 1 2.25 12a4.49 4.49 0 0 1 1.549-3.397 4.491 4.491 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                      </svg>
                      <h2 className="text-sm font-semibold text-emerald-400">My Contributions</h2>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        {historyEntries.length}
                      </span>
                      <span className="text-xs text-gray-600 ml-1">Submitted — no action needed</span>
                    </div>

                    <div className="space-y-2">
                      {historyEntries.map(({ item, level }) => (
                        <ContributionCard key={`hist-${item.id}-l${level}`} item={item} level={level} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Pending assignment card ────────────────────────────────────────────────────

function AssignmentCard({ item, level }: { item: TranscriptReviewItem; level: 1 | 2 }) {
  const [expanded, setExpanded] = useState(false);
  const levelColor = level === 1 ? "border-blue-500/20 bg-blue-500/5" : "border-purple-500/20 bg-purple-500/5";

  return (
    <div className={`rounded-xl border overflow-hidden ${levelColor}`}>
      <div className="flex items-center gap-3 p-3">
        {item.videoThumbnailUrl ? (
          <img
            src={item.videoThumbnailUrl}
            alt={item.videoTitle}
            className="w-14 h-10 object-cover rounded-lg flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-10 rounded-lg bg-gray-800 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate leading-tight">{item.videoTitle}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.localeName}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {item.transcriptPreview && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              {expanded ? "Hide ▲" : "Preview ▼"}
            </button>
          )}
          <Link
            href={`/proofread/editor?id=${item.id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
            Edit
          </Link>
        </div>
      </div>

      {expanded && item.transcriptPreview && (
        <div className="px-3 pb-3">
          <p className="text-xs text-gray-400 leading-relaxed font-mono bg-gray-950 rounded-lg p-3 whitespace-pre-wrap">
            {item.transcriptPreview}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Contribution history card (read-only, clearly done) ────────────────────────

function ContributionCard({ item, level }: { item: TranscriptReviewItem; level: 1 | 2 }) {
  const levelLabel = level === 1 ? "L1" : "L2";
  const levelColor = level === 1 ? "text-blue-400 bg-blue-500/10 border-blue-500/20" : "text-purple-400 bg-purple-500/10 border-purple-500/20";

  // Show what happened after this submission
  const statusBadge = (() => {
    if (item.approvalStatus === "APPROVED") return { label: "Approved", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    if (item.approvalStatus === "LEVEL1_APPROVED") return { label: "L1 Approved", cls: "text-teal-400 bg-teal-500/10 border-teal-500/20" };
    return { label: "Under review", cls: "text-gray-500 bg-gray-800 border-gray-700" };
  })();

  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {item.videoThumbnailUrl ? (
          <div className="relative flex-shrink-0">
            <img
              src={item.videoThumbnailUrl}
              alt={item.videoTitle}
              className="w-14 h-10 object-cover rounded-lg opacity-70"
            />
            {/* Done checkmark overlay */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="w-14 h-10 rounded-lg bg-gray-800 flex-shrink-0 opacity-70" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-300 truncate leading-tight">{item.videoTitle}</p>
          <p className="text-xs text-gray-600 mt-0.5">{item.localeName}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Level badge */}
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${levelColor}`}>
            {levelLabel} Review
          </span>
          {/* Approval status */}
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>
    </div>
  );
}
