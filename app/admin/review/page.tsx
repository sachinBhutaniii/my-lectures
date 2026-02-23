"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getTranscriptForEditor,
  TranscriptEditorData,
} from "@/services/video.service";
import TranscriptEditor from "@/components/TranscriptEditor";

function ReviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, authLoading, isAdmin } = useAuth();

  const id = searchParams.get("id");
  const [data, setData] = useState<TranscriptEditorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) { router.replace("/"); return; }
    if (!id) { router.replace("/admin"); return; }

    getTranscriptForEditor(Number(id))
      .then(setData)
      .catch(() => setError("Failed to load transcript. Please go back and try again."))
      .finally(() => setLoading(false));
  }, [id, user, authLoading, isAdmin, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={() => router.push("/admin")}
          className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-300 hover:border-gray-500 transition-colors"
        >
          Back to Admin
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <TranscriptEditor
      data={data}
      mode="admin"
      onBack={() => router.push("/admin")}
    />
  );
}

export default function AdminReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
