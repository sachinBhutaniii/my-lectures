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
  getAllLocales,
  createLocale,
  deleteLocale,
  TranscriptReviewItem,
  UserSearchResult,
  LocaleInfo,
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
  const [showAddLang, setShowAddLang] = useState(false);

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
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Manage Languages button */}
          <button
            onClick={() => setShowAddLang(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Manage Languages
          </button>
          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Approved</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Assigned</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-600" />Pending</span>
          </div>
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
          {Object.values(
            list.reduce<Record<number, TranscriptReviewItem[]>>((acc, item) => {
              (acc[item.videoId] ??= []).push(item);
              return acc;
            }, {})
          ).map((group) => (
            <VideoGroup
              key={group[0].videoId}
              items={group}
              isParentAdmin={isParentAdmin}
              isAdmin={isAdmin}
              acting={acting}
              onOpenModal={(item, level) => setModal({ item, level })}
              onApprove={handleApprove}
              onReject={handleReject}
              onDeploy={handleDeploy}
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

      {/* Manage Languages modal */}
      {showAddLang && (
        <ManageLanguagesModal onClose={() => setShowAddLang(false)} />
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

// ── Video group (expandable) ──────────────────────────────────────────────────

type VideoGroupProps = {
  items: TranscriptReviewItem[];
  isParentAdmin: boolean;
  isAdmin: boolean;
  acting: number | null;
  onOpenModal: (item: TranscriptReviewItem, level: 1 | 2) => void;
  onApprove: (item: TranscriptReviewItem) => void;
  onReject: (item: TranscriptReviewItem) => void;
  onDeploy: (item: TranscriptReviewItem) => void;
};

function VideoGroup({ items, isParentAdmin, isAdmin, acting, onOpenModal, onApprove, onReject, onDeploy }: VideoGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);

  const first = items[0];
  const selectedItem = selectedLocale ? items.find((i) => i.localeCode === selectedLocale) : null;

  // Count statuses for the summary badges
  const deployedCount = items.filter((i) => i.deployed).length;
  const approvedCount = items.filter((i) => i.approvalStatus === "APPROVED" && !i.deployed).length;

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${
      deployedCount === items.length && items.length > 0 ? "border-green-500/20" : "border-gray-800"
    } bg-gray-900/60`}>
      {/* Video header row — click to expand */}
      <button
        onClick={() => { setExpanded(!expanded); if (expanded) setSelectedLocale(null); }}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-800/30 transition-colors"
      >
        {/* Expand chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
        </svg>

        {/* Thumbnail */}
        {first.videoThumbnailUrl ? (
          <img src={first.videoThumbnailUrl} alt={first.videoTitle} className="w-12 h-9 object-cover rounded-lg flex-shrink-0" />
        ) : (
          <div className="w-12 h-9 rounded-lg bg-gray-800 flex-shrink-0" />
        )}

        {/* Title + summary */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate leading-tight">{first.videoTitle}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-500">
              {items.length} language{items.length !== 1 ? "s" : ""}
            </span>
            {deployedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/30 text-green-400 font-medium">
                {deployedCount} deployed
              </span>
            )}
            {approvedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-medium">
                {approvedCount} approved
              </span>
            )}
          </div>
        </div>

        {/* Language pills preview (collapsed) */}
        {!expanded && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {items.map((i) => (
              <span
                key={i.id}
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  i.deployed
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : i.approvalStatus === "APPROVED"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                    : "border-gray-700 bg-gray-800 text-gray-500"
                }`}
              >
                {i.localeCode.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded: language tabs + transcript details */}
      {expanded && (
        <div className="border-t border-gray-800">
          {/* Language tabs */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900/80">
            {items.map((i) => {
              const isActive = selectedLocale === i.localeCode;
              return (
                <button
                  key={i.id}
                  onClick={() => setSelectedLocale(isActive ? null : i.localeCode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isActive
                      ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
                      : i.deployed
                      ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/15"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {i.localeName}
                  {i.deployed && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 inline ml-1 -mt-0.5">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected language transcript details */}
          {selectedItem && (
            <TranscriptRow
              item={selectedItem}
              isParentAdmin={isParentAdmin}
              isAdmin={isAdmin}
              acting={acting === selectedItem.id}
              onOpenModal={(level) => onOpenModal(selectedItem, level)}
              onApprove={() => onApprove(selectedItem)}
              onReject={() => onReject(selectedItem)}
              onDeploy={() => onDeploy(selectedItem)}
            />
          )}
        </div>
      )}
    </div>
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
    <div className="border-t border-gray-800">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">{item.localeName}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              item.deployed
                ? "bg-green-500/15 border border-green-500/30 text-green-400"
                : item.approvalStatus === "APPROVED"
                ? "bg-blue-500/15 border border-blue-500/30 text-blue-400"
                : item.approvalStatus === "LEVEL1_APPROVED"
                ? "bg-yellow-500/15 border border-yellow-500/30 text-yellow-400"
                : "bg-gray-800 border border-gray-700 text-gray-500"
            }`}>
              {item.deployed ? "Deployed" : item.approvalStatus === "APPROVED" ? "Approved" : item.approvalStatus === "LEVEL1_APPROVED" ? "L1 Approved" : "Draft"}
            </span>
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
  const [locales, setLocales] = useState<LocaleInfo[]>([]);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [proofreaders, setProofreaders] = useState<UserSearchResult[]>([]);
  const [loadingLocales, setLoadingLocales] = useState(true);
  const [loadingProofreaders, setLoadingProofreaders] = useState(false);

  // Load available languages on mount
  useEffect(() => {
    let cancelled = false;
    getAllLocales()
      .then((data) => { if (!cancelled) { setLocales(data); setLoadingLocales(false); } })
      .catch(() => { if (!cancelled) setLoadingLocales(false); });
    return () => { cancelled = true; };
  }, []);

  // When a language is selected, fetch proofreaders for that language
  useEffect(() => {
    if (!selectedLocale) { setProofreaders([]); return; }
    let cancelled = false;
    setLoadingProofreaders(true);
    getProofreaders(selectedLocale).then((data) => {
      if (!cancelled) { setProofreaders(data); setLoadingProofreaders(false); }
    }).catch(() => {
      if (!cancelled) setLoadingProofreaders(false);
    });
    return () => { cancelled = true; };
  }, [selectedLocale]);

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

          {/* Step 1: Language selection */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">1. Select language</p>
            {loadingLocales ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {locales.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLocale(l.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedLocale === l.code
                        ? "border-purple-500/50 bg-purple-500/20 text-purple-300"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
                {locales.length === 0 && (
                  <p className="text-xs text-gray-600">No languages configured. Add languages via Manage Languages.</p>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Proofreader list (only after language is selected) */}
          {selectedLocale && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">2. Select proofreader</p>
              {loadingProofreaders ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : proofreaders.length === 0 ? (
                <div className="text-center py-4 text-gray-600">
                  <p className="text-sm">No proofreaders for this language.</p>
                  <p className="text-xs mt-1 text-gray-700">Assign this language to proofreaders in the Users tab.</p>
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-1.5">
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
              )}
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

// ── Manage Languages modal ───────────────────────────────────────────────────

function ManageLanguagesModal({ onClose }: { onClose: () => void }) {
  const [locales, setLocales] = useState<LocaleInfo[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAllLocales()
      .then((data) => { if (!cancelled) { setLocales(data); setLoadingData(false); } })
      .catch(() => { if (!cancelled) setLoadingData(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    if (!newCode.trim() || !newName.trim()) { setErr("Both code and name are required."); return; }
    setSaving(true);
    setErr("");
    try {
      const created = await createLocale(newCode.trim(), newName.trim());
      setLocales((prev) => [...prev, created]);
      setNewCode("");
      setNewName("");
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { error?: string } } };
      setErr(axiosErr?.response?.data?.error ?? "Failed to create language.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    setErr("");
    try {
      await deleteLocale(id);
      setLocales((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setErr("Failed to delete language.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-[#111] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <p className="text-sm font-semibold text-white">Manage Languages</p>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loadingData ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Existing languages */}
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Current languages</p>
                {locales.length === 0 ? (
                  <p className="text-xs text-gray-600 py-2">No languages configured yet.</p>
                ) : (
                  locales.map((l) => (
                    <div key={l.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900 border border-gray-800">
                      <div>
                        <span className="text-sm text-gray-200">{l.name}</span>
                        <span className="text-xs text-gray-500 ml-2">({l.code})</span>
                      </div>
                      <button
                        onClick={() => handleDelete(l.id)}
                        disabled={deleting !== null}
                        className="text-xs text-red-400 border border-red-500/30 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {deleting === l.id ? (
                          <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : "Delete"}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {err && <p className="text-red-400 text-xs">{err}</p>}

              {/* Add new language */}
              <div className="space-y-2 border-t border-gray-800 pt-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Add new language</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Code (e.g. bn)"
                    className="w-20 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-purple-500/50 placeholder-gray-600"
                  />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name (e.g. Bengali)"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-purple-500/50 placeholder-gray-600"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg text-xs font-medium border border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                    ) : "Add"}
                  </button>
                </div>
              </div>
            </>
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
