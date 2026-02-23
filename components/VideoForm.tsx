"use client";
import { LectureVideo } from "@/types/videos";
import { useState, useEffect, useRef } from "react";
import { uploadImage } from "@/services/video.service";

type VideoFormProps = {
  initialData?: Partial<LectureVideo>;
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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const inputCls =
  "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-orange-500 transition-colors";

export default function VideoForm({ initialData, onSubmit, onCancel, isLoading }: VideoFormProps) {
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
  });

  const [keywordInput, setKeywordInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      });
    }
  }, [initialData]);

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
    setFormData((prev) => ({
      ...prev,
      keywords: [...(prev.keywords ?? []), kw],
    }));
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: (prev.keywords ?? []).filter((k) => k !== kw),
    }));
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleThumbnailUpload}
              className="hidden"
            />
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
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
              }}
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
          <input
            type="text"
            name="speaker"
            value={formData.speaker}
            onChange={handleChange}
            className={inputCls}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className={inputCls}
          />
        </Field>
      </div>

      {/* City + Country */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <input
            type="text"
            name="city"
            value={formData.place?.city || ""}
            onChange={handlePlaceChange}
            placeholder="e.g. Mayapur"
            className={inputCls}
          />
        </Field>
        <Field label="Country">
          <input
            type="text"
            name="country"
            value={formData.place?.country || ""}
            onChange={handlePlaceChange}
            placeholder="e.g. India"
            className={inputCls}
          />
        </Field>
      </div>

      {/* URLs */}
      <Field label="Video URL">
        <input
          type="text"
          name="videoUrl"
          required
          value={formData.videoUrl}
          onChange={handleChange}
          placeholder="https://…"
          className={inputCls}
        />
      </Field>

      <Field label="Audio URL">
        <input
          type="text"
          name="audioUrl"
          value={formData.audioUrl}
          onChange={handleChange}
          placeholder="https://…"
          className={inputCls}
        />
      </Field>

      <Field label="Key (SKU)">
        <input
          type="text"
          name="key"
          value={formData.key}
          onChange={handleChange}
          placeholder="e.g. sb-1-1-001"
          className={inputCls}
        />
      </Field>

      {/* Transcript */}
      <Field label="Transcript">
        <textarea
          name="transcript"
          rows={3}
          value={formData.transcript}
          onChange={handleChange}
          placeholder="Plain text transcript…"
          className={inputCls + " resize-none"}
        />
      </Field>

      <Field label="Transcript SRT">
        <textarea
          name="transcriptSrt"
          rows={2}
          value={formData.transcriptSrt}
          onChange={handleChange}
          placeholder="SRT subtitle content…"
          className={inputCls + " resize-none"}
        />
      </Field>

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
