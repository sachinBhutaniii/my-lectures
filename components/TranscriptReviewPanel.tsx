"use client";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useFetch } from "@/hooks/useFetch";
import {
  getAllTranscripts,
  approveTranscript,
  rejectTranscript,
  assignProofreader,
  deployTranscript,
  getProofreaders,
  TranscriptReviewItem,
  UserSearchResult,
} from "@/services/video.service";
import { useAuth } from "@/context/AuthContext";

// ── L1/L2 button status helpers ──────────────────────────────────────────────

type LevelStatus = "approved" | "submitted" | "assigned" | "neutral";

function getL1Status(item: TranscriptReviewItem): LevelStatus {
  if (item.approvalStatus === "LEVEL1_APPROVED" || item.approvalStatus === "APPROVED") return "approved";
  if (item.l1ReviewSubmitted) return "submitted";
  if (item.level1ProofreaderId != null) return "assigned";
  return "neutral";
}

function getL2Status(item: TranscriptReviewItem): LevelStatus {
  if (item.approvalStatus === "APPROVED") return "approved";
  if (item.l2ReviewSubmitted) return "submitted";
  if (item.level2ProofreaderId != null) return "assigned";
  return "neutral";
}

const LEVEL_BUTTON_STYLE: Record<LevelStatus, string> = {
  approved:  "bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30",
  submitted: "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20",
  assigned:  "bg-orange-500/15 border-orange-500/40 text-orange-400 hover:bg-orange-500/25",
  neutral:   "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400",
};

// ── Main panel ────────────────────────────────────────────────────────────────

type ModalState = { item: TranscriptReviewItem; level: 1 | 2 } | null;

export default function TranscriptReviewPanel() {
  const { isParentAdmin, isAdmin } = useAuth();

  const transcriptFn = useCallback(() => getAllTranscripts(), []);
  const { data: items, loading, setData } = useFetch<TranscriptReviewItem[]>(transcriptFn);

  const [modal, setModal] = useState<ModalState>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [error, setError] = useState("");

  const updateItem = (updated: TranscriptReviewItem) =>
    setData((prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)));

  const handleApprove = async (item: TranscriptReviewItem) => {
    setActing(item.id);
    setError("");
    try {
      updateItem(await approveTranscript(item.id));
    } catch {
      setError("Approval failed. Please try again.");
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (item: TranscriptReviewItem) => {
    setActing(item.id);
    setError("");
    try {
      updateItem(await rejectTranscript(item.id));
    } catch {
      setError("Reset failed. Please try again.");
    } finally {
      setActing(null);
    }
  };

  const handleDeploy = async (item: TranscriptReviewItem) => {
    setActing(item.id);
    setError("");
    try {
      updateItem(await deployTranscript(item.id));
    } catch {
      setError("Deploy failed. Please try again.");
    } finally {
      setActing(null);
    }
  };

  const handleAssign = async (transcriptId: number, userId: number | null, level: 1 | 2) => {
    setError("");
    try {
      updateItem(await assignProofreader(transcriptId, userId, level));
      setModal(null);
    } catch {
      setError("Assignment failed. Please try again.");
    }
  };

  const list = items ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Transcript Review</h2>
          <p className="text-xs text-gray-500 mt-1">
            {isParentAdmin
              ? "Assign proofreaders, approve transcripts, and deploy."
              : "Assign proofreaders and give Level 1 approval."}
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-shrink-0">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Approved</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Assigned</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-600" />Pending</span>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-sm">No transcripts found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((item) => (
            <TranscriptRow
              key={item.id}
              item={item}
              isParentAdmin={isParentAdmin}
              isAdmin={isAdmin}
              acting={acting === item.id}
              onOpenModal={(level) => setModal({ item, level })}
              onApprove={() => handleApprove(item)}
              onReject={() => handleReject(item)}
              onDeploy={() => handleDeploy(item)}
            />
          ))}
        </div>
      )}

      {/* Assignment modal */}
      {modal && (
        <AssignModal
          item={modal.item}
          level={modal.level}
          isParentAdmin={isParentAdmin}
          isAdmin={isAdmin}
          onAssign={(userId) => handleAssign(modal.item.id, userId, modal.level)}
          onApprove={() => { handleApprove(modal.item); setModal(null); }}
          onReject={() => { handleReject(modal.item); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Level button ──────────────────────────────────────────────────────────────

function LevelButton({
  label, status, proofreaderName, approvedByName, onClick,
}: {
  label: string;
  status: LevelStatus;
  proofreaderName: string | null;
  approvedByName: string | null;
  onClick: () => void;
}) {
  const firstName = (name: string | null) => name?.split(" ")[0] ?? null;
  // Always show the proofreader who did the work, not the admin who approved
  const displayName = firstName(proofreaderName);

  const title =
    status === "approved"   ? `${label} approved by ${approvedByName ?? proofreaderName ?? "—"}`
    : status === "submitted" ? `${label} submitted by ${proofreaderName ?? "—"} — awaiting admin approval`
    : status === "assigned"  ? `${label} assigned to ${proofreaderName ?? "—"}`
    : `Assign ${label} proofreader`;

  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors flex-shrink-0 min-w-[36px] ${LEVEL_BUTTON_STYLE[status]}`}
    >
      <span className="flex items-center gap-1">
        {status === "approved" || status === "submitted" ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
        ) : status === "assigned" ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        )}
        {label}
      </span>
      {displayName && (
        <span className="text-[9px] truncate max-w-[52px] font-normal leading-tight mt-0.5 opacity-80">
          {displayName}
        </span>
      )}
    </button>
  );
}

// ── Transcript row ────────────────────────────────────────────────────────────

type RowProps = {
  item: TranscriptReviewItem;
  isParentAdmin: boolean;
  isAdmin: boolean;
  acting: boolean;
  onOpenModal: (level: 1 | 2) => void;
  onApprove: () => void;
  onReject: () => void;
  onDeploy: () => void;
};

function TranscriptRow({ item, isParentAdmin, acting, onOpenModal, onApprove, onReject, onDeploy }: RowProps) {
  const l1Status = getL1Status(item);
  const l2Status = getL2Status(item);
  const canApproveL1 = item.approvalStatus === "DRAFT";
  const canApproveFinal = item.approvalStatus === "LEVEL1_APPROVED" && isParentAdmin;
  const canReset = item.approvalStatus !== "DRAFT" && isParentAdmin;
  const canDeploy = item.approvalStatus === "APPROVED" && !item.deployed && isParentAdmin;

  return (
    <div className={`rounded-xl border bg-gray-900/60 overflow-hidden transition-colors ${
      item.deployed ? "border-green-500/20" : "border-gray-800"
    }`}>
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        {item.videoThumbnailUrl ? (
          <img
            src={item.videoThumbnailUrl}
            alt={item.videoTitle}
            className="w-12 h-9 object-cover rounded-lg flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-9 rounded-lg bg-gray-800 flex-shrink-0" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate leading-tight">{item.videoTitle}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-500">{item.localeName}</span>
            {item.deployed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/30 text-green-400 font-medium">
                Deployed
              </span>
            )}
          </div>
        </div>

        {/* L1 button */}
        <LevelButton
          label="L1"
          status={l1Status}
          proofreaderName={item.level1ProofreaderName}
          approvedByName={item.level1ApprovedByName}
          onClick={() => onOpenModal(1)}
        />

        {/* L2 button */}
        <LevelButton
          label="L2"
          status={l2Status}
          proofreaderName={item.level2ProofreaderName}
          approvedByName={item.finalApprovedByName}
          onClick={() => onOpenModal(2)}
        />

        {/* Review Edits link — shown when L1 or L2 submitted their work */}
        {(item.l1ReviewSubmitted || item.l2ReviewSubmitted) && !item.deployed && (
          <Link
            href={`/admin/review?id=${item.id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex-shrink-0"
            title="Open transcript editor to review submitted edits"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
            </svg>
            Review{item.l2ReviewSubmitted ? " L2" : " L1"}
          </Link>
        )}

        {/* Approve / Reset / Deploy actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canApproveL1 && (
            <button
              onClick={onApprove}
              disabled={acting}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              {acting ? <Spinner color="blue" /> : "Approve L1"}
            </button>
          )}
          {canApproveFinal && (
            <button
              onClick={onApprove}
              disabled={acting}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              {acting ? <Spinner color="green" /> : "Final ✦"}
            </button>
          )}
          {canReset && (
            <button
              onClick={onReject}
              disabled={acting}
              className="px-2.5 py-1.5 rounded-lg text-[11px] border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {acting ? <Spinner color="red" /> : "Reset"}
            </button>
          )}
          {canDeploy && (
            <button
              onClick={onDeploy}
              disabled={acting}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {acting ? <Spinner color="green" /> : "Deploy ↑"}
            </button>
          )}
          {item.deployed && (
            <span className="text-[11px] text-emerald-500 font-medium">Live</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Assignment modal ──────────────────────────────────────────────────────────

type ModalProps = {
  item: TranscriptReviewItem;
  level: 1 | 2;
  isParentAdmin: boolean;
  isAdmin: boolean;
  onAssign: (userId: number | null) => void;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
};

function AssignModal({ item, level, isParentAdmin, isAdmin, onAssign, onApprove, onReject, onClose }: ModalProps) {
  const [proofreaders, setProofreaders] = useState<UserSearchResult[]>([]);
  const [loadingProofreaders, setLoadingProofreaders] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingProofreaders(true);
    getProofreaders(item.localeCode).then((data) => {
      if (!cancelled) {
        setProofreaders(data);
        setLoadingProofreaders(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingProofreaders(false);
    });
    return () => { cancelled = true; };
  }, [item.localeCode]);

  const currentProofreaderId = level === 1 ? item.level1ProofreaderId : item.level2ProofreaderId;
  const currentProofreaderName = level === 1 ? item.level1ProofreaderName : item.level2ProofreaderName;

  const canApproveHere =
    (level === 1 && item.approvalStatus === "DRAFT") ||
    (level === 2 && item.approvalStatus === "LEVEL1_APPROVED" && isParentAdmin);
  const canReset = item.approvalStatus !== "DRAFT" && isParentAdmin;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-[#111] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div>
            <p className="text-sm font-semibold text-white">
              Level {level} Proofreader
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{item.videoTitle} · {item.localeName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current assignment */}
          {currentProofreaderName && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <div>
                <p className="text-xs text-gray-500">Currently assigned</p>
                <p className="text-sm text-orange-300 font-medium">{currentProofreaderName}</p>
              </div>
              <button
                onClick={() => onAssign(null)}
                className="text-xs text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* Proofreader list */}
          {loadingProofreaders ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : proofreaders.length === 0 ? (
            <div className="text-center py-6 text-gray-600">
              <p className="text-sm">No proofreaders for {item.localeName}.</p>
              <p className="text-xs mt-1 text-gray-700">Assign this language to proofreaders in the Users tab.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Select proofreader</p>
              <div className="max-h-52 overflow-y-auto space-y-1.5">
                {proofreaders.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => onAssign(u.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left ${
                      currentProofreaderId === u.id
                        ? "border-orange-500/40 bg-orange-500/10"
                        : "border-gray-800 bg-gray-900 hover:border-gray-700"
                    }`}
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-gray-300">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-100 truncate leading-tight">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    {currentProofreaderId === u.id && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-orange-400 flex-shrink-0">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Approval actions */}
          {(canApproveHere || canReset) && (
            <div className="border-t border-gray-800 pt-3 flex gap-2">
              {canApproveHere && (
                <button
                  onClick={onApprove}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    level === 1
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                      : "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                  }`}
                >
                  {level === 1 ? "Approve Level 1" : "Final Approve ✦"}
                </button>
              )}
              {canReset && (
                <button
                  onClick={onReject}
                  className="px-4 py-2 rounded-xl text-xs border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Reset to Draft
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Spinner helper ────────────────────────────────────────────────────────────

function Spinner({ color }: { color: "blue" | "green" | "red" }) {
  const cls = { blue: "border-blue-400", green: "border-green-400", red: "border-red-400" }[color];
  return <div className={`w-3 h-3 border border-t-transparent rounded-full animate-spin ${cls}`} />;
}
