"use client";
import { LectureVideo, LanguageData } from "@/types/videos";
import { useState, useEffect, useRef, useCallback } from "react";
import { uploadImage, getVideoById, getLanguageData, extractYouTubeAudio, startPipeline, confirmPipeline, getPipelineStatus } from "@/services/video.service";

type VideoFormProps = {
  initialData?: Partial<LectureVideo>;
  videoId?: number;          // needed to load transcripts for existing lectures
  onSubmit: (data: Omit<LectureVideo, "id">) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
};

const CATEGORY_OPTIONS = [
  { code: "sb",     label: "Śrīmad-Bhāgavatam" },
  { code: "bg",     label: "Bhagavad-gītā" },
  { code: "cc",     label: "Caitanya-caritāmṛta" },
  { code: "vsn",    label: "Vaiṣṇava Songs" },
  { code: "minars", label: "Seminars" },
  { code: "others", label: "Others" },
];

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function detectCategory(title: string): string | null {
  if (/\bSB\s+\d/i.test(title)) return "sb";
  if (/\bBG\s+\d/i.test(title)) return "bg";
  if (/\bCC\s+\d/i.test(title)) return "cc";
  return null;
}

function extractStartTime(url: string): number | null {
  // Matches ?t=90, &t=90, ?t=1h30m5s, ?t=5m, ?t=90s, ?start=120
  const m = url.match(/[?&](?:t|start)=([^&]+)/);
  if (!m) return null;
  const val = m[1];
  // Pure number = seconds
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  // Duration format: 1h30m5s, 5m, 90s, etc.
  let total = 0;
  const hours = val.match(/(\d+)h/);
  const mins = val.match(/(\d+)m/);
  const secs = val.match(/(\d+)s/);
  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (mins) total += parseInt(mins[1], 10) * 60;
  if (secs) total += parseInt(secs[1], 10);
  return total > 0 ? total : null;
}

function formatStartTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function generateKey(title: string, date: string): string {
  // Try to extract scripture reference like "SB 5.14.28" → "SB-5.14.28"
  const refMatch = title.match(/\b(SB|BG|CC)\s+([\d.]+)/i);
  if (refMatch) {
    const ref = `${refMatch[1].toUpperCase()}-${refMatch[2]}`;
    return date ? `${ref}-${date}` : ref;
  }
  // Fallback: first 3 words
  const words = title.replace(/[^\w\s]/g, "").trim().split(/\s+/).slice(0, 3).join("-").toLowerCase();
  return date ? `${words}-${date}` : words;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const inputCls =
  "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-orange-500 transition-colors";

export default function VideoForm({ initialData, videoId, onSubmit, onCancel, isLoading }: VideoFormProps) {
  const [formData, setFormData] = useState<Omit<LectureVideo, "id">>({
    title: "",
    videoUrl: "",
    thumbnailUrl: "",
    audioUrl: "",
    transcript: "",
    transcriptSrt: "",
    key: "",
    date: new Date().toISOString().split("T")[0],
    speaker: "BDDS",
    place: { city: "", country: "" },
    category: [],
    description: "",
    keywords: [],
    locale: "en",
    startTime: undefined,
    visibility: "PUBLIC",
  });

  const [keywordInput, setKeywordInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // YouTube auto-populate
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytFetching, setYtFetching] = useState(false);
  const [ytError, setYtError] = useState("");
  const [audioExtracting, setAudioExtracting] = useState(false);
  const [audioError, setAudioError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transcript locale state
  const [languages, setLanguages] = useState<LanguageData[]>([]);
  const [transcriptLocale, setTranscriptLocale] = useState("en");
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [langSearch, setLangSearch] = useState("");

  // Transcription pipeline state
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState("");
  const [transcriptionError, setTranscriptionError] = useState("");

  // Load available languages once
  useEffect(() => {
    getLanguageData().then(setLanguages).catch(() => {});
  }, []);

  // Populate form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        videoUrl: initialData.videoUrl || "",
        thumbnailUrl: initialData.thumbnailUrl || "",
        audioUrl: initialData.audioUrl || "",
        transcript: initialData.transcript || "",
        transcriptSrt: initialData.transcriptSrt || "",
        key: initialData.key || "",
        date: initialData.date || new Date().toISOString().split("T")[0],
        speaker: initialData.speaker || "BDDS",
        place: initialData.place || { city: "", country: "" },
        category: initialData.category || [],
        description: initialData.description || "",
        keywords: initialData.keywords || [],
        startTime: initialData.startTime,
        locale: "en",
        visibility: initialData.visibility || "PUBLIC",
      });
      setTranscriptLocale("en");
      setTranscriptLoaded(false);
    }
  }, [initialData]);

  const loadTranscript = useCallback(async (locale: string) => {
    if (!videoId) return;
    setTranscriptLoading(true);
    setTranscriptLoaded(false);
    try {
      const video = await getVideoById(videoId, locale);
      setFormData((prev) => ({
        ...prev,
        transcript: video.transcript || "",
        transcriptSrt: video.transcriptSrt || "",
        locale,
      }));
      setTranscriptLoaded(true);
    } catch {
      setFormData((prev) => ({ ...prev, transcript: "", transcriptSrt: "", locale }));
    } finally {
      setTranscriptLoading(false);
    }
  }, [videoId]);

  const handleLocaleSelect = (code: string) => {
    setTranscriptLocale(code);
    setShowLangDropdown(false);
    setLangSearch("");
    loadTranscript(code);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      place: { ...(prev.place || { city: "", country: "" }), [name]: value },
    }));
  };

  const toggleCategory = (code: string) => {
    setFormData((prev) => {
      const cats = prev.category ?? [];
      return {
        ...prev,
        category: cats.includes(code) ? cats.filter((c) => c !== code) : [...cats, code],
      };
    });
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    setFormData((prev) => ({ ...prev, keywords: [...(prev.keywords ?? []), kw] }));
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    setFormData((prev) => ({ ...prev, keywords: (prev.keywords ?? []).filter((k) => k !== kw) }));
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadImage(file);
      setFormData((prev) => ({ ...prev, thumbnailUrl: url }));
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleYoutubeFetch = async () => {
    setYtError("");
    setAudioError("");
    const vid = extractVideoId(youtubeUrl.trim());
    if (!vid) {
      setYtError("Invalid YouTube URL");
      return;
    }
    setYtFetching(true);
    const urlStr = youtubeUrl.trim();
    const startSeconds = extractStartTime(urlStr);

    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vid}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const title = data.title || "";
      const cat = detectCategory(title);

      setFormData((prev) => {
        const updates: Partial<typeof prev> = {};
        if (!prev.title && title) updates.title = title;
        if (!prev.videoUrl) updates.videoUrl = urlStr;
        if (!prev.thumbnailUrl) updates.thumbnailUrl = `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`;
        if (cat && (!prev.category || prev.category.length === 0)) updates.category = [cat];
        if (!prev.key) updates.key = generateKey(title, prev.date || "");
        if (startSeconds != null && prev.startTime == null) updates.startTime = startSeconds;
        return { ...prev, ...updates };
      });
    } catch {
      setYtError("Failed to fetch video info. Check the URL and try again.");
    } finally {
      setYtFetching(false);
    }

    // Extract audio in parallel (fire-and-forget, fills audioUrl when done)
    setAudioExtracting(true);
    extractYouTubeAudio(urlStr, startSeconds ?? undefined)
      .then((s3Url) => {
        setFormData((prev) => {
          if (!prev.audioUrl) return { ...prev, audioUrl: s3Url };
          return prev;
        });
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || err?.message || "Unknown error";
        setAudioError(`Audio extraction failed: ${msg}`);
      })
      .finally(() => {
        setAudioExtracting(false);
      });
  };

  const handleTranscribe = async () => {
    const url = youtubeUrl.trim() || formData.videoUrl;
    if (!url) {
      setTranscriptionError("Enter a YouTube URL first");
      return;
    }

    setTranscribing(true);
    setTranscriptionError("");
    setTranscriptionProgress("Extracting metadata...");

    try {
      // Phase 1: Start pipeline (extracts metadata)
      const startTimestamp = formData.startTime ? String(formData.startTime) : undefined;
      const metadata = await startPipeline(url, startTimestamp);
      setTranscriptionProgress("Metadata extracted. Starting transcription...");

      // Auto-fill form fields from pipeline metadata if empty
      setFormData((prev) => {
        const updates: Partial<typeof prev> = {};
        if (!prev.title && metadata.title) updates.title = metadata.title;
        if (!prev.thumbnailUrl && metadata.thumbnailUrl) updates.thumbnailUrl = metadata.thumbnailUrl;
        if (!prev.key && metadata.generatedKey) updates.key = metadata.generatedKey;
        if ((!prev.category || prev.category.length === 0) && metadata.categories?.length > 0) updates.category = metadata.categories;
        if (!prev.place?.city && metadata.city) updates.place = { city: metadata.city, country: metadata.country || prev.place?.country || "" };
        if (!prev.place?.country && metadata.country) updates.place = { city: prev.place?.city || metadata.city || "", country: metadata.country };
        if (metadata.uploadDate && !prev.date) {
          const d = metadata.uploadDate;
          if (d.length === 8) updates.date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
        }
        return { ...prev, ...updates };
      });

      // Phase 2: Confirm and start transcription
      await confirmPipeline(metadata.jobId, {
        city: formData.place?.city || metadata.city || undefined,
        country: formData.place?.country || metadata.country || undefined,
        categories: formData.category?.length ? formData.category : metadata.categories,
        speaker: formData.speaker || undefined,
        generatedKey: formData.key || metadata.generatedKey || undefined,
      });
      setTranscriptionProgress("Transcribing audio with Gemini AI...");

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const status = await getPipelineStatus(metadata.jobId);
          if (status.progressLog) {
            const lines = status.progressLog.split("\n");
            setTranscriptionProgress(lines[lines.length - 1]);
          }

          if (status.status === "COMPLETED") {
            clearInterval(pollInterval);
            setTranscribing(false);
            setTranscriptionProgress("");

            // Load the created video's transcript data
            if (status.resultVideoId) {
              try {
                const video = await getVideoById(status.resultVideoId, "en");
                setFormData((prev) => ({
                  ...prev,
                  transcript: video.transcript || prev.transcript,
                  transcriptSrt: video.transcriptSrt || prev.transcriptSrt,
                  audioUrl: video.audioUrl || prev.audioUrl,
                }));
              } catch {
                // Video was created but we couldn't load it — user can refresh
              }
            }
          } else if (status.status === "FAILED") {
            clearInterval(pollInterval);
            setTranscribing(false);
            setTranscriptionError(status.errorMessage || "Transcription failed");
            setTranscriptionProgress("");
          }
        } catch {
          clearInterval(pollInterval);
          setTranscribing(false);
          setTranscriptionError("Lost connection while checking transcription status");
          setTranscriptionProgress("");
        }
      }, 5000);
    } catch (err: unknown) {
      setTranscribing(false);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setTranscriptionError(`Transcription failed: ${msg}`);
      setTranscriptionProgress("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const selectedLangName = languages.find((l) => l.code === transcriptLocale)?.name ?? "English";
  const filteredLangs = languages.filter((l) =>
    l.name.toLowerCase().includes(langSearch.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Populate from YouTube */}
      <div className="border border-gray-700 rounded-xl p-4 space-y-3 bg-gray-900/40">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Populate from YouTube</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => { setYoutubeUrl(e.target.value); setYtError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleYoutubeFetch(); } }}
            placeholder="Paste YouTube URL…"
            className={inputCls + " flex-1"}
          />
          <button
            type="button"
            onClick={handleYoutubeFetch}
            disabled={ytFetching || !youtubeUrl.trim()}
            className="px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {ytFetching && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Fetch
          </button>
        </div>
        {ytError && <p className="text-red-400 text-xs">{ytError}</p>}
      </div>

      {/* Title */}
      <Field label="Title">
        <input
          type="text"
          name="title"
          required
          value={formData.title}
          onChange={handleChange}
          placeholder="Lecture title…"
          className={inputCls}
        />
      </Field>

      {/* Description */}
      <Field label="Description">
        <textarea
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
          placeholder="Short description of this lecture…"
          className={inputCls + " resize-none"}
        />
      </Field>

      {/* Visibility toggle */}
      <Field label="Visibility">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, visibility: "PUBLIC" }))}
            className={`flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              formData.visibility !== "PRIVATE"
                ? "bg-green-500/15 border-green-500/40 text-green-400"
                : "bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Public
          </button>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, visibility: "PRIVATE" }))}
            className={`flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              formData.visibility === "PRIVATE"
                ? "bg-red-500/15 border-red-500/40 text-red-400"
                : "bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            Private
          </button>
        </div>
        {formData.visibility === "PRIVATE" && (
          <p className="text-xs text-gray-600 mt-1.5">Only admins and proofreaders can see this lecture.</p>
        )}
      </Field>

      {/* Category pills */}
      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((opt) => {
            const active = (formData.category ?? []).includes(opt.code);
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => toggleCategory(opt.code)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-400 hover:border-orange-500/50 hover:text-orange-400"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Thumbnail upload */}
      <Field label="Thumbnail">
        <div className="flex gap-3 items-start">
          {formData.thumbnailUrl ? (
            <img
              src={formData.thumbnailUrl}
              alt="thumb"
              className="w-20 h-14 object-cover rounded-lg border border-gray-700 flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-14 rounded-lg border border-dashed border-gray-700 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-6 h-6 text-gray-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-2 text-sm rounded-lg border border-gray-700 text-gray-300 hover:border-orange-500 hover:text-orange-400 transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload image"}
            </button>
            <input
              type="text"
              name="thumbnailUrl"
              value={formData.thumbnailUrl}
              onChange={handleChange}
              placeholder="…or paste URL"
              className={inputCls + " text-xs"}
            />
            {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
          </div>
        </div>
      </Field>

      {/* Keywords */}
      <Field label="Search Keywords">
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
              placeholder="Type keyword and press Enter…"
              className={inputCls + " flex-1"}
            />
            <button
              type="button"
              onClick={addKeyword}
              className="px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:border-orange-500 hover:text-orange-400 transition-colors text-sm"
            >
              Add
            </button>
          </div>
          {(formData.keywords ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(formData.keywords ?? []).map((kw) => (
                <span key={kw} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-300">
                  {kw}
                  <button type="button" onClick={() => removeKeyword(kw)} className="text-gray-500 hover:text-red-400 transition-colors ml-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Field>

      {/* Speaker + Date */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Speaker">
          <input type="text" name="speaker" value={formData.speaker} onChange={handleChange} className={inputCls} />
        </Field>
        <Field label="Date">
          <input type="date" name="date" value={formData.date} onChange={handleChange} className={inputCls} />
        </Field>
      </div>

      {/* City + Country */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <input type="text" name="city" value={formData.place?.city || ""} onChange={handlePlaceChange} placeholder="e.g. Mayapur" className={inputCls} />
        </Field>
        <Field label="Country">
          <input type="text" name="country" value={formData.place?.country || ""} onChange={handlePlaceChange} placeholder="e.g. India" className={inputCls} />
        </Field>
      </div>

      {/* URLs */}
      <Field label="Video URL">
        <input type="text" name="videoUrl" required value={formData.videoUrl} onChange={handleChange} placeholder="https://…" className={inputCls} />
      </Field>
      <Field label="Audio URL">
        <div className="relative">
          <input type="text" name="audioUrl" value={formData.audioUrl} onChange={handleChange} placeholder="https://…" className={inputCls} />
          {audioExtracting && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-orange-400">
              <div className="w-3 h-3 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
              Extracting audio…
            </span>
          )}
        </div>
        {audioError && <p className="text-red-400 text-xs mt-1">{audioError}</p>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key (SKU)">
          <input type="text" name="key" value={formData.key} onChange={handleChange} placeholder="e.g. sb-1-1-001" className={inputCls} />
        </Field>
        <Field label="Start Time (seconds)">
          <div className="relative">
            <input
              type="number"
              name="startTime"
              min={0}
              value={formData.startTime ?? ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
              placeholder="e.g. 5400"
              className={inputCls}
            />
            {formData.startTime != null && formData.startTime > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                {formatStartTime(formData.startTime)}
              </span>
            )}
          </div>
        </Field>
      </div>

      {/* ── Transcript section ── */}
      <div className="border border-gray-800 rounded-xl p-4 space-y-4 bg-gray-900/30">
        {/* Section header + language picker */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Transcript</span>

          <div className="flex items-center gap-2">
            {/* Language picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangDropdown((v) => !v)}
                className="flex items-center gap-1.5 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 bg-gray-900 hover:border-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
                <span>{selectedLangName}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-2.5 h-2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showLangDropdown && (
                <div className="absolute right-0 top-9 z-50 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-gray-800">
                    <input
                      type="text"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder="Search language…"
                      className="w-full bg-gray-800 text-xs text-gray-300 placeholder-gray-600 rounded-lg px-2.5 py-1.5 outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredLangs.length > 0 ? (
                      filteredLangs.map((lang) => (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => handleLocaleSelect(lang.code)}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                            lang.code === transcriptLocale
                              ? "text-orange-400 bg-gray-800"
                              : "text-gray-300 hover:bg-gray-800"
                          }`}
                        >
                          {lang.name}
                        </button>
                      ))
                    ) : (
                      <p className="text-gray-600 text-xs px-3 py-2">No results</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Load button — only for existing lectures */}
            {videoId && (
              <button
                type="button"
                onClick={() => loadTranscript(transcriptLocale)}
                disabled={transcriptLoading}
                className="flex items-center gap-1 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:border-orange-500 hover:text-orange-400 transition-colors disabled:opacity-50"
              >
                {transcriptLoading ? (
                  <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
                Load
              </button>
            )}
          </div>
        </div>

        {/* Transcribe with AI button */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleTranscribe}
            disabled={transcribing || (!youtubeUrl.trim() && !formData.videoUrl)}
            className="w-full py-2.5 rounded-xl border border-purple-500/40 text-sm font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {transcribing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                Transcribing…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
                Transcribe with AI
              </>
            )}
          </button>

          {transcriptionProgress && (
            <p className="text-xs text-purple-400 flex items-center gap-1.5">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              {transcriptionProgress}
            </p>
          )}
          {transcriptionError && (
            <p className="text-xs text-red-400">{transcriptionError}</p>
          )}
        </div>

        {/* Status badge */}
        {videoId && transcriptLoaded && (
          <p className="text-[11px] text-green-500/80 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            Loaded {selectedLangName} transcript
          </p>
        )}
        {!videoId && (
          <p className="text-[11px] text-gray-600">Save the lecture first, then load/edit transcripts per language.</p>
        )}

        {/* Transcript textarea */}
        <div>
          <label className="block text-xs text-gray-600 mb-1.5">Plain text transcript</label>
          <textarea
            name="transcript"
            rows={6}
            value={formData.transcript}
            onChange={handleChange}
            placeholder={videoId ? "Click Load to fetch existing transcript, or type here…" : "Transcript text…"}
            disabled={transcriptLoading}
            className={inputCls + " resize-y disabled:opacity-40"}
          />
        </div>

        {/* SRT textarea */}
        <div>
          <label className="block text-xs text-gray-600 mb-1.5">SRT subtitles</label>
          <textarea
            name="transcriptSrt"
            rows={4}
            value={formData.transcriptSrt}
            onChange={handleChange}
            placeholder={videoId ? "Click Load to fetch existing SRT, or paste here…" : "SRT content…"}
            disabled={transcriptLoading}
            className={inputCls + " resize-y font-mono text-xs disabled:opacity-40"}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || uploading}
          className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {isLoading ? "Saving…" : "Save Lecture"}
        </button>
      </div>
    </form>
  );
}
