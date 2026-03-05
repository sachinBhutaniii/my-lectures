"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import SadhanaTracker from "@/components/SadhanaTracker";
import SadhanaHistory from "@/components/SadhanaHistory";
import SadhanaMentees from "@/components/SadhanaMentees";
import MentorLinkSheet from "@/components/MentorLinkSheet";

type SadhanaTab = "today" | "records" | "mentees";

export default function SadhanaPage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<SadhanaTab>("today");
  const [showMentorSheet, setShowMentorSheet] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const TABS: { id: SadhanaTab; label: string }[] = [
    { id: "today",   label: "Today"      },
    { id: "records", label: "My Records" },
    { id: "mentees", label: "My Mentees" },
  ];

  return (
    <div className="h-screen bg-black text-white w-full max-w-4xl xl:max-w-6xl mx-auto flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-white leading-tight">Sadhana Tracker</h1>
          <p className="text-[11px] text-gray-600">Daily practice card</p>
        </div>
        {/* Mentor link icon */}
        <button
          onClick={() => setShowMentorSheet(true)}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors flex-shrink-0"
          title="Link mentor"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 px-4 flex-shrink-0 border-b border-gray-800/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "today"   && <SadhanaTracker />}
        {activeTab === "records" && <SadhanaHistory />}
        {activeTab === "mentees" && <SadhanaMentees />}
      </div>

      {showMentorSheet && <MentorLinkSheet onClose={() => setShowMentorSheet(false)} />}
    </div>
  );
}
