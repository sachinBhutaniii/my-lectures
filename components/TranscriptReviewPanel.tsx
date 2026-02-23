"use client";
import { useState, useCallback } from "react";
import { useFetch } from "@/hooks/useFetch";
import {
  getTranscriptsForReview,
  approveTranscript,
  rejectTranscript,
  TranscriptReviewItem,
} from "@/services/video.service";
import { useAuth } from "@/context/AuthContext";

const STATUS_INFO: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT:           { label: "Awaiting Level 1",  color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", dot: "bg-yellow-400" },
  LEVEL1_APPROVED: { label: "Awaiting Final",    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",     dot: "bg-blue-400"   },
  APPROVED:        { label: "Approved",           color: "text-green-400 bg-green-500/10 border-green-500/30",  dot: "bg-green-400"  },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_INFO[status] ?? { label: status, color: "text-gray-400 bg-gray-800 border-gray-700", dot: "bg-gray-400" };
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${info.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

export default function TranscriptReviewPanel() {
  const { isParentAdmin } = useAuth();
  const fetchFn = useCallback(() => getTranscriptsForReview(), []);
  const { data: items, loading, setData } = useFetch<TranscriptReviewItem[]>(fetchFn);
  const [acting, setActing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState("");

  const handleApprove = async (item: TranscriptReviewItem) => {
    setActing(item.id);
    setError("");
    try {
      const updated = await approveTranscript(item.id);
      setData((prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      setError("Failed to approve. Please try again.");
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (item: TranscriptReviewItem) => {
    setActing(item.id);
    setError("");
    try {
      const updated = await rejectTranscript(item.id);
      setData((prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      setError("Failed to reset. Please try again.");
    } finally {
      setActing(null);
    }
  };

  const pending = (items ?? []).filter((t) => t.approvalStatus !== "APPROVED");
  const approved = (items ?? []).filter((t) => t.approvalStatus === "APPROVED");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-white">Transcript Review</h2>
        <p className="text-xs text-gray-500 mt-1">
          {isParentAdmin
            ? "You can give Level 1 and Final (Level 2) approvals."
            : "You can give Level 1 approval. Final approval is done by the parent admin."}
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (items ?? []).length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
          <p className="text-sm">No transcripts pending review.</p>
        </div>
      ) : (
        <>
          {/* Pending section */}
          {pending.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                Pending ({pending.length})
              </p>
              {pending.map((item) => (
                <TranscriptCard
                  key={item.id}
                  item={item}
                  isParentAdmin={isParentAdmin}
                  acting={acting === item.id}
                  expanded={expanded === item.id}
                  onToggleExpand={() => setExpanded(expanded === item.id ? null : item.id)}
                  onApprove={() => handleApprove(item)}
                  onReject={() => handleReject(item)}
                />
              ))}
            </section>
          )}

          {/* Approved section — collapsible */}
          {approved.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                Approved ({approved.length})
              </p>
              {approved.map((item) => (
                <TranscriptCard
                  key={item.id}
                  item={item}
                  isParentAdmin={isParentAdmin}
                  acting={acting === item.id}
                  expanded={expanded === item.id}
                  onToggleExpand={() => setExpanded(expanded === item.id ? null : item.id)}
                  onApprove={() => handleApprove(item)}
                  onReject={() => handleReject(item)}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Individual transcript card ──────────────────────────────────────────────

type CardProps = {
  item: TranscriptReviewItem;
  isParentAdmin: boolean;
  acting: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
};

function TranscriptCard({ item, isParentAdmin, acting, expanded, onToggleExpand, onApprove, onReject }: CardProps) {
  const canApproveLevel1 = item.approvalStatus === "DRAFT";
  const canApproveFinal = item.approvalStatus === "LEVEL1_APPROVED" && isParentAdmin;
  const canReject = item.approvalStatus !== "DRAFT" && isParentAdmin;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Thumbnail */}
        {item.videoThumbnailUrl ? (
          <img
            src={item.videoThumbnailUrl}
            alt={item.videoTitle}
            className="w-14 h-10 object-cover rounded-lg flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-10 rounded-lg bg-gray-800 flex-shrink-0" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate">{item.videoTitle}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.localeName}</p>

          {/* Approval trail */}
          <div className="flex flex-wrap gap-2 mt-1.5">
            {item.level1ApprovedByName && (
              <span className="text-[10px] text-gray-600">
                L1: <span className="text-gray-500">{item.level1ApprovedByName}</span>
              </span>
            )}
            {item.finalApprovedByName && (
              <span className="text-[10px] text-gray-600">
                Final: <span className="text-gray-500">{item.finalApprovedByName}</span>
              </span>
            )}
          </div>
        </div>

        {/* Status + expand */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge status={item.approvalStatus} />
          {item.transcriptPreview && (
            <button
              onClick={onToggleExpand}
              className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              {expanded ? "Hide ▲" : "Preview ▼"}
            </button>
          )}
        </div>
      </div>

      {/* Transcript preview */}
      {expanded && item.transcriptPreview && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400 leading-relaxed font-mono bg-gray-950 rounded-lg p-3 whitespace-pre-wrap">
            {item.transcriptPreview}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {(canApproveLevel1 || canApproveFinal || canReject) && (
        <div className="px-4 pb-4 flex gap-2">
          {canApproveLevel1 && (
            <button
              onClick={onApprove}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              {acting ? <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" /> : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              )}
              Level 1 Approve
            </button>
          )}
          {canApproveFinal && (
            <button
              onClick={onApprove}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              {acting ? <div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" /> : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              )}
              Final Approve ✦
            </button>
          )}
          {canReject && (
            <button
              onClick={onReject}
              disabled={acting}
              className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {acting ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : "Reset"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
