"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getTranscriptForEditor,
  TranscriptEditorData,
} from "@/services/video.service";
import TranscriptEditor from "@/components/TranscriptEditor";
import { rememberReturnTo } from "@/lib/session";

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, authLoading, isProofreader } = useAuth();

  const id = searchParams.get("id");
  const [data, setData] = useState<TranscriptEditorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Fixed when the transcript loads, so a later logout can't flip the editor's mode
  const [level, setLevel] = useState<1 | 2>(1);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    // Once the editor is open, a lost session is handled inside the editor (it locks
    // and keeps changes on the device) — never navigate away and drop unsaved work.
    if (loadedIdRef.current !== null) return;
    if (!user) {
      rememberReturnTo(window.location.pathname + window.location.search);
      router.replace("/login");
      return;
    }
    if (!isProofreader) { router.replace("/"); return; }
    if (!id) { router.replace("/proofread"); return; }

    loadedIdRef.current = id;
    getTranscriptForEditor(Number(id))
      .then((d) => {
        setLevel(d.level2ProofreaderId === user.id ? 2 : 1);
        setData(d);
      })
      .catch(() => setError("Failed to load transcript. Please go back and try again."))
      .finally(() => setLoading(false));
  }, [id, user, authLoading, isProofreader, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={() => router.push("/proofread")}
          className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-300 hover:border-gray-500 transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <TranscriptEditor
      data={data}
      mode={level === 2 ? "l2" : "l1"}
      level={level}
      onBack={() => router.push("/proofread")}
    />
  );
}

export default function ProofreadEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
