"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { rememberReturnTo } from "@/lib/session";
import TranscriptHistory from "@/components/TranscriptHistory";

function Spinner() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, authLoading, isAdmin, isTranscriptAdmin } = useAuth();
  const id = Number(searchParams.get("id"));
  const allowed = isAdmin || isTranscriptAdmin;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      rememberReturnTo(window.location.pathname + window.location.search);
      router.replace("/login");
      return;
    }
    if (!allowed) { router.replace("/"); return; }
    if (!id) router.replace("/admin");
  }, [user, authLoading, allowed, id, router]);

  if (authLoading || !user || !allowed || !id) return <Spinner />;
  return <TranscriptHistory transcriptId={id} canRestore={isAdmin} onBack={() => router.push("/admin")} />;
}

export default function TranscriptHistoryPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <HistoryContent />
    </Suspense>
  );
}
