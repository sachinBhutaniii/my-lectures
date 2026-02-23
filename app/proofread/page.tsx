"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { getMyAssignments, TranscriptReviewItem } from "@/services/video.service";

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

  const level1Items = (items ?? []).filter(
    (t) => t.level1ProofreaderId != null && t.approvalStatus === "DRAFT"
  );
  const level2Items = (items ?? []).filter(
    (t) => t.level2ProofreaderId != null && t.approvalStatus === "LEVEL1_APPROVED"
  );

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
        ) : (items ?? []).length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            <p className="text-sm">No transcripts assigned to you yet.</p>
            <p className="text-xs mt-1 text-gray-700">An admin will assign transcripts for review.</p>
          </div>
        ) : (
          <>
            {/* Level 1 assignments */}
            {level1Items.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[10px] font-bold text-blue-400">1</span>
                  <h2 className="text-sm font-semibold text-gray-300">Level 1 Review</h2>
                  <span className="text-xs text-gray-600">({level1Items.length})</span>
                </div>
                <div className="space-y-2">
                  {level1Items.map((item) => (
                    <AssignmentCard key={item.id} item={item} level={1} />
                  ))}
                </div>
              </section>
            )}

            {/* Level 2 assignments */}
            {level2Items.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px] font-bold text-purple-400">2</span>
                  <h2 className="text-sm font-semibold text-gray-300">Level 2 Review</h2>
                  <span className="text-xs text-gray-600">({level2Items.length})</span>
                </div>
                <div className="space-y-2">
                  {level2Items.map((item) => (
                    <AssignmentCard key={item.id} item={item} level={2} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Assignment card ───────────────────────────────────────────────────────────

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

        {item.transcriptPreview && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
          >
            {expanded ? "Hide ▲" : "Preview ▼"}
          </button>
        )}
      </div>

      {expanded && item.transcriptPreview && (
        <div className="px-3 pb-3">
          <p className="text-xs text-gray-400 leading-relaxed font-mono bg-gray-950 rounded-lg p-3 whitespace-pre-wrap">
            {item.transcriptPreview}
          </p>
          <p className="text-xs text-gray-600 mt-2 text-center">
            Full transcript editing will be available in a future update.
          </p>
        </div>
      )}
    </div>
  );
}
