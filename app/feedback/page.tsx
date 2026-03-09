"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getCategories,
  submitFeedback,
  uploadFile,
  FeedbackCategory,
} from "@/services/feedback.service";

type RecordingState = "idle" | "recording" | "recorded";

export default function FeedbackPage() {
  const { user, authLoading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [message, setMessage] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // Audio recording
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenshotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    getCategories().then(setCategories).catch(() => {});
  }, [user, authLoading, router]);

  // ── Audio recording ─────────────────────────────────────────────────────────

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecordingState("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecordingState("recording");
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const discardRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingState("idle");
  };

  // ── Screenshot ──────────────────────────────────────────────────────────────

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!message.trim() && !audioBlob) {
      setError("Please write a message or record audio before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      let uploadedAudioUrl: string | undefined;
      let uploadedScreenshotUrl: string | undefined;

      if (audioBlob) {
        const audioFile = new File([audioBlob], "feedback-audio.webm", { type: "audio/webm" });
        uploadedAudioUrl = await uploadFile(audioFile);
      }
      if (screenshotFile) {
        uploadedScreenshotUrl = await uploadFile(screenshotFile);
      }

      await submitFeedback({
        categoryId,
        message: message.trim() || undefined,
        audioUrl: uploadedAudioUrl,
        screenshotUrl: uploadedScreenshotUrl,
      });

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-orange-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-white text-2xl font-bold mb-3">Thank You, {user?.name?.split(" ")[0]}!</h2>
        <p className="text-orange-400 font-semibold text-sm tracking-wide uppercase mb-4">✦ Your Voice Matters ✦</p>
        <p className="text-gray-300 text-base leading-relaxed max-w-xs mb-2">
          Your feedback has been received with gratitude. We are listening, and every word you share helps us serve the devotees better.
        </p>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs mb-8 italic">
          "sevā sādhanā" — service is the highest practice. Your feedback is an act of loving service to the community.
        </p>
        <button
          onClick={() => router.back()}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-gray-800 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Share Feedback</h1>
          <p className="text-gray-500 text-xs">Help us serve you better</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full space-y-6">

        {/* Category */}
        <div>
          <label className="block text-gray-400 text-xs font-semibold tracking-wide uppercase mb-2">
            Category <span className="text-gray-600 normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryId(undefined)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                categoryId === undefined
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              General
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  categoryId === cat.id
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-gray-400 text-xs font-semibold tracking-wide uppercase mb-2">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your feedback, suggestion, or issue…"
            rows={5}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-orange-500/60 transition-colors"
          />
        </div>

        {/* Audio recording */}
        <div>
          <label className="block text-gray-400 text-xs font-semibold tracking-wide uppercase mb-2">
            Voice Message <span className="text-gray-600 normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            {recordingState === "idle" && (
              <button
                onClick={startRecording}
                className="w-full flex items-center justify-center gap-3 py-2 text-gray-300 hover:text-white transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-400">
                    <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                    <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                  </svg>
                </span>
                <span className="text-sm">Tap to record voice message</span>
              </button>
            )}

            {recordingState === "recording" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-sm font-medium">Recording…</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="px-4 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
                >
                  Stop
                </button>
              </div>
            )}

            {recordingState === "recorded" && audioUrl && (
              <div className="space-y-3">
                <audio src={audioUrl} controls className="w-full h-10" />
                <button
                  onClick={discardRecording}
                  className="text-gray-500 text-xs hover:text-red-400 transition-colors"
                >
                  Discard recording
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Screenshot */}
        <div>
          <label className="block text-gray-400 text-xs font-semibold tracking-wide uppercase mb-2">
            Screenshot <span className="text-gray-600 normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <input
            ref={screenshotInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleScreenshot}
          />
          {screenshotPreview ? (
            <div className="relative">
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                className="w-full rounded-xl border border-gray-700 object-contain max-h-48"
              />
              <button
                onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => screenshotInputRef.current?.click()}
              className="w-full border border-dashed border-gray-700 rounded-xl py-5 flex flex-col items-center gap-2 text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="text-sm">Tap to attach screenshot</span>
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit Feedback"
          )}
        </button>

        <div className="h-8" />
      </div>
    </div>
  );
}
