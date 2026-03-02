"use client";

import { useRouter } from "next/navigation";
import SadhanaTracker from "@/components/SadhanaTracker";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export default function SadhanaPage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();

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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <SadhanaTracker />
      </div>
    </div>
  );
}
