"use client";
import { useEffect } from "react";
import { TranscriptReviewItem } from "@/services/video.service";

// ── Notification data model ───────────────────────────────────────────────────

export type AdminNotif = {
  id: string;
  type: "review_submitted";
  videoTitle: string;
  localeName: string;
  proofreaderName: string;
  level: 1 | 2;
  submittedAt: string | null;
};

export function deriveNotifications(items: TranscriptReviewItem[]): AdminNotif[] {
  const notifs: AdminNotif[] = [];
  for (const item of items) {
    if (item.l1ReviewSubmitted && item.level1ProofreaderName) {
      notifs.push({
        id: `${item.id}-l1`,
        type: "review_submitted",
        videoTitle: item.videoTitle,
        localeName: item.localeName,
        proofreaderName: item.level1ProofreaderName,
        level: 1,
        submittedAt: item.l1SubmittedAt ?? null,
      });
    }
    if (item.l2ReviewSubmitted && item.level2ProofreaderName) {
      notifs.push({
        id: `${item.id}-l2`,
        type: "review_submitted",
        videoTitle: item.videoTitle,
        localeName: item.localeName,
        proofreaderName: item.level2ProofreaderName,
        level: 2,
        submittedAt: item.l2SubmittedAt ?? null,
      });
    }
  }
  return notifs.sort((a, b) => {
    if (!a.submittedAt && !b.submittedAt) return 0;
    if (!a.submittedAt) return 1;
    if (!b.submittedAt) return -1;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Panel component ───────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  notifications: AdminNotif[];
  /** The lastCheck value before this open — used to decide which dots to show */
  unreadCutoff: string | null;
  onClose: () => void;
};

export default function AdminNotificationPanel({ open, notifications, unreadCutoff, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const isUnread = (n: AdminNotif) =>
    !!n.submittedAt && (!unreadCutoff || new Date(n.submittedAt) > new Date(unreadCutoff));

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-50 bg-[#0d0d0d] border-l border-gray-800 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-orange-400">
              <path fillRule="evenodd" d="M4 8a6 6 0 1 1 12 0c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 1-.804.346 12.023 12.023 0 0 1-2.347-.705.75.75 0 0 0-.573 0 12.023 12.023 0 0 1-2.347.705.75.75 0 0 1-.804-.346A11.966 11.966 0 0 1 4 8Zm6 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" clipRule="evenodd" />
            </svg>
            <h2 className="text-sm font-semibold text-white">Notifications</h2>
            {notifications.length > 0 && (
              <span className="text-[10px] text-gray-600 font-normal">{notifications.length} total</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-7 h-7 text-gray-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">No notifications yet</p>
                <p className="text-xs text-gray-700 mt-1">Review submissions will appear here</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {notifications.map((n) => {
                const unread = isUnread(n);
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${
                      unread ? "bg-orange-500/[0.05]" : ""
                    }`}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 pt-1.5">
                      <span className={`block w-1.5 h-1.5 rounded-full ${
                        unread ? "bg-orange-500" : "bg-gray-800"
                      }`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Who did what */}
                      <p className={`text-xs leading-snug ${unread ? "text-gray-100" : "text-gray-400"}`}>
                        <span className="font-semibold">{n.proofreaderName.split(" ")[0]}</span>
                        <span className={unread ? " text-gray-400" : " text-gray-600"}> submitted </span>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
                          n.level === 1
                            ? "bg-orange-500/15 text-orange-400"
                            : "bg-blue-500/15 text-blue-400"
                        }`}>
                          L{n.level}
                        </span>
                        <span className={unread ? " text-gray-400" : " text-gray-600"}> review</span>
                      </p>

                      {/* Video title */}
                      <p className={`text-[11px] mt-1 font-medium truncate ${
                        unread ? "text-gray-300" : "text-gray-600"
                      }`}>
                        {n.videoTitle}
                      </p>

                      {/* Language + time */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                          unread
                            ? "border-gray-700 bg-gray-800 text-gray-400"
                            : "border-gray-800 bg-gray-900 text-gray-600"
                        }`}>
                          {n.localeName}
                        </span>
                        {n.submittedAt && (
                          <span className="text-[10px] text-gray-700">
                            {timeAgo(n.submittedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
