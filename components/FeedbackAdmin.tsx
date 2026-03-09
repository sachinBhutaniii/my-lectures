"use client";

import { useEffect, useState } from "react";
import {
  FeedbackCategory,
  FeedbackItem,
  createCategory,
  deleteCategory,
  getCategories,
  getFeedback,
  replyToFeedback,
} from "@/services/feedback.service";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CategoryManager({
  categories,
  onUpdate,
}: {
  categories: FeedbackCategory[];
  onUpdate: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createCategory(newName.trim());
      setNewName("");
      onUpdate();
    } catch {
      setError("Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this category? Existing feedback will retain its category reference.")) return;
    setDeletingId(id);
    try {
      await deleteCategory(id);
      onUpdate();
    } catch {
      setError("Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4 text-orange-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
        Feedback Categories
      </h3>

      {/* Existing categories */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.length === 0 && (
          <p className="text-gray-600 text-xs italic">No categories yet. Add one below.</p>
        )}
        {categories.map((cat) => (
          <span
            key={cat.id}
            className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-sm text-gray-300"
          >
            {cat.name}
            <button
              onClick={() => handleDelete(cat.id)}
              disabled={deletingId === cat.id}
              className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New category name…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/60"
        />
        <button
          onClick={handleCreate}
          disabled={saving || !newName.trim()}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "…" : "Add"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}

function ReplyBox({ item, onReplied }: { item: FeedbackItem; onReplied: (updated: FeedbackItem) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(item.adminReply ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const updated = await replyToFeedback(item.id, text.trim());
      onReplied(updated);
      setOpen(false);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-800 pt-3">
      {item.adminReply && !open && (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2 mb-2">
          <p className="text-orange-400 text-[10px] font-semibold uppercase tracking-wide mb-1">Admin Reply</p>
          <p className="text-gray-300 text-sm leading-relaxed">{item.adminReply}</p>
          {item.repliedAt && (
            <p className="text-gray-600 text-xs mt-1">{formatDate(item.repliedAt)}</p>
          )}
        </div>
      )}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
        >
          {item.adminReply ? "Edit reply" : "Reply"}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a reply to this feedback…"
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500/60"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save Reply"}
            </button>
            <button
              onClick={() => { setOpen(false); setText(item.adminReply ?? ""); }}
              className="px-4 py-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ item, onUpdate }: { item: FeedbackItem; onUpdate: (updated: FeedbackItem) => void }) {
  const [screenshotOpen, setScreenshotOpen] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium text-sm">{item.userName}</span>
            {item.adminReply && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Replied
              </span>
            )}
          </div>
          <p className="text-gray-600 text-xs truncate">{item.userEmail}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {item.categoryName && (
            <span className="inline-block bg-gray-800 border border-gray-700 text-gray-400 text-[10px] font-medium px-2 py-0.5 rounded-full mb-1">
              {item.categoryName}
            </span>
          )}
          <p className="text-gray-600 text-[10px]">{formatDate(item.createdAt)}</p>
        </div>
      </div>

      {/* Message */}
      {item.message && (
        <p className="text-gray-300 text-sm leading-relaxed mb-3 whitespace-pre-wrap">{item.message}</p>
      )}

      {/* Audio */}
      {item.audioUrl && (
        <div className="mb-3">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">Voice Message</p>
          <audio src={item.audioUrl} controls className="w-full h-9" />
        </div>
      )}

      {/* Screenshot */}
      {item.screenshotUrl && (
        <div className="mb-3">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">Screenshot</p>
          <button onClick={() => setScreenshotOpen(true)} className="block">
            <img
              src={item.screenshotUrl}
              alt="Screenshot"
              className="rounded-lg border border-gray-700 max-h-32 object-contain hover:opacity-80 transition-opacity"
            />
          </button>
        </div>
      )}

      {/* Reply */}
      <ReplyBox item={item} onReplied={onUpdate} />

      {/* Screenshot lightbox */}
      {screenshotOpen && item.screenshotUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setScreenshotOpen(false)}
        >
          <img src={item.screenshotUrl} alt="Screenshot" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}

export default function FeedbackAdmin() {
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [filterCategoryId, setFilterCategoryId] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [cats, items] = await Promise.all([
        getCategories(),
        getFeedback(),
      ]);
      setCategories(cats);
      setFeedbackList(items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const loadFiltered = async (catId?: number) => {
    setFilterCategoryId(catId);
    setLoading(true);
    try {
      const items = await getFeedback(catId);
      setFeedbackList(items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleItemUpdate = (updated: FeedbackItem) => {
    setFeedbackList((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  };

  const visibleFeedback = feedbackList;

  return (
    <div>
      {/* Category manager */}
      <CategoryManager
        categories={categories}
        onUpdate={() => getCategories().then(setCategories)}
      />

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Filter:</span>
        <button
          onClick={() => loadFiltered(undefined)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            filterCategoryId === undefined
              ? "bg-orange-500 border-orange-500 text-white"
              : "border-gray-700 text-gray-400 hover:border-gray-500"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => loadFiltered(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterCategoryId === cat.id
                ? "bg-orange-500 border-orange-500 text-white"
                : "border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Feedback count */}
      <p className="text-gray-600 text-xs mb-4">
        {visibleFeedback.length} submission{visibleFeedback.length !== 1 ? "s" : ""}
      </p>

      {/* Feedback list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visibleFeedback.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          <p className="text-sm">No feedback yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleFeedback.map((item) => (
            <FeedbackCard key={item.id} item={item} onUpdate={handleItemUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
