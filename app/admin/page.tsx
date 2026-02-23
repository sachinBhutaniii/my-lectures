"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AdminVideoList from "@/components/AdminVideoList";
import AdminUserManager from "@/components/AdminUserManager";
import TranscriptReviewPanel from "@/components/TranscriptReviewPanel";
import JnanaYagyaAdmin from "@/components/JnanaYagyaAdmin";
import { getSubmittedReviews, TranscriptReviewItem } from "@/services/video.service";

type Tab = "videos" | "transcripts" | "users" | "jnana";

const TABS: { id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  {
    id: "videos",
    label: "Videos",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    id: "transcripts",
    label: "Transcripts",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    id: "users",
    label: "Users",
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    id: "jnana",
    label: "Jñāna Yajña",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
      </svg>
    ),
  },
];

export default function AdminPage() {
  const { user, authLoading, isAdmin, isParentAdmin } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("videos");
  const [submittedReviews, setSubmittedReviews] = useState<TranscriptReviewItem[]>([]);
  const [notifDismissed, setNotifDismissed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) router.replace("/");
  }, [user, authLoading, isAdmin, router]);

  // Poll for submitted reviews (notification badge)
  useEffect(() => {
    if (!isAdmin) return;
    getSubmittedReviews().then(setSubmittedReviews).catch(() => {});
  }, [isAdmin]);

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isParentAdmin);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Admin header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-gray-800">
        <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 text-orange-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </span>
          <h1 className="text-white font-bold text-lg">Admin Panel</h1>
          {isParentAdmin && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 border border-amber-400/30 text-amber-300">
              Parent
            </span>
          )}
        </div>
        <span className="ml-auto text-orange-500/70 text-xs font-mono">{user?.email}</span>
      </div>

      {/* Review submitted notification banner */}
      {submittedReviews.length > 0 && !notifDismissed && (
        <div className="mx-5 mt-3 flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-400">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-200">
              {submittedReviews.length} transcript review{submittedReviews.length > 1 ? "s" : ""} ready
            </p>
            <p className="text-xs text-gray-400 truncate">
              {submittedReviews.map((r) => r.videoTitle).join(", ")}
            </p>
          </div>
          <button
            onClick={() => { setActiveTab("transcripts"); setNotifDismissed(true); }}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            Review
          </button>
          <button
            onClick={() => setNotifDismissed(true)}
            className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-5 pt-4 pb-0 border-b border-gray-800">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-6xl p-6">
        {activeTab === "videos"      && <AdminVideoList />}
        {activeTab === "transcripts" && <TranscriptReviewPanel />}
        {activeTab === "users"       && isParentAdmin && <AdminUserManager />}
        {activeTab === "jnana"       && <JnanaYagyaAdmin />}
      </div>
    </div>
  );
}
