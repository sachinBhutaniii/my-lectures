"use client";

import { useCallback, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import {
  adminGetQuestions,
  adminCreateQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
  adminReorderQuestions,
  SadhanaQuestion,
  SadhanaOption,
} from "@/services/sadhana.service";

const CATEGORIES = ["Nidra", "Japa", "Seva", "Study", "Principles"];

const CATEGORY_COLORS: Record<string, string> = {
  Nidra:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
  Japa:       "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Seva:       "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Study:      "bg-teal-500/15 text-teal-400 border-teal-500/30",
  Principles: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

type EditForm = {
  title: string;
  description: string;
  category: string;
  active: boolean;
  hidden: boolean;
  options: SadhanaOption[];
};

const emptyForm = (): EditForm => ({
  title: "",
  description: "",
  category: CATEGORIES[0],
  active: true,
  hidden: false,
  options: [],
});

const questionToForm = (q: SadhanaQuestion): EditForm => ({
  title: q.title,
  description: q.description ?? "",
  category: q.category ?? CATEGORIES[0],
  active: q.active,
  hidden: q.hidden,
  options: [...q.options],
});

export default function SadhanaAdmin() {
  const [rev, setRev] = useState(0);
  const refetch = () => setRev((c) => c + 1);
  const fetchQuestions = useCallback(() => adminGetQuestions(), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: questions, loading } = useFetch<SadhanaQuestion[]>(fetchQuestions);

  const [expandedId, setExpandedId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm());
  const [newSlug, setNewSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState("");

  const openEdit = (q: SadhanaQuestion) => {
    setExpandedId(q.id);
    setForm(questionToForm(q));
    setError("");
  };

  const openNew = () => {
    setExpandedId("new");
    setForm(emptyForm());
    setNewSlug("");
    setError("");
  };

  const closeEdit = () => {
    setExpandedId(null);
    setError("");
  };

  const handleSave = async (q: SadhanaQuestion | null) => {
    setSaving(true);
    setError("");
    try {
      if (q) {
        await adminUpdateQuestion(q.id, {
          title: form.title,
          description: form.description,
          category: form.category,
          displayOrder: q.displayOrder,
          active: form.active,
          hidden: form.hidden,
          options: form.options,
        });
      } else {
        if (!newSlug.trim()) { setError("Slug is required"); setSaving(false); return; }
        if (!form.title.trim()) { setError("Title is required"); setSaving(false); return; }
        await adminCreateQuestion({
          slug: newSlug.trim(),
          title: form.title,
          description: form.description,
          category: form.category,
          displayOrder: (questions?.length ?? 0) + 1,
          active: form.active,
          hidden: form.hidden,
          options: form.options,
        });
      }
      await refetch();
      closeEdit();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await adminDeleteQuestion(id);
      await refetch();
      if (expandedId === id) closeEdit();
    } catch (e: any) {
      alert("Delete failed: " + (e?.response?.data?.message ?? "Unknown error"));
    } finally {
      setDeleting(null);
    }
  };

  const moveQuestion = async (q: SadhanaQuestion, dir: -1 | 1) => {
    const sorted = [...(questions ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((x) => x.id === q.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    setReordering(true);
    const items = [
      { id: sorted[idx].id, displayOrder: sorted[swapIdx].displayOrder },
      { id: sorted[swapIdx].id, displayOrder: sorted[idx].displayOrder },
    ];
    try {
      await adminReorderQuestions(items);
      await refetch();
    } finally {
      setReordering(false);
    }
  };

  // ── Option editor helpers ─────────────────────────────────────────────────
  const addOption = () =>
    setForm((f) => ({ ...f, options: [...f.options, { value: "", label: "", points: 0 }] }));

  const updateOption = (i: number, patch: Partial<SadhanaOption>) =>
    setForm((f) => {
      const opts = [...f.options];
      opts[i] = { ...opts[i], ...patch };
      return { ...f, options: opts };
    });

  const removeOption = (i: number) =>
    setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));

  const moveOption = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const opts = [...f.options];
      const j = i + dir;
      if (j < 0 || j >= opts.length) return f;
      [opts[i], opts[j]] = [opts[j], opts[i]];
      return { ...f, options: opts };
    });

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sorted = [...(questions ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Sadhana Questions</h2>
          <p className="text-xs text-gray-500 mt-0.5">{sorted.length} questions</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Question
        </button>
      </div>

      {/* New question form */}
      {expandedId === "new" && (
        <QuestionForm
          form={form}
          setForm={setForm}
          slug={newSlug}
          setSlug={setNewSlug}
          showSlug
          onSave={() => handleSave(null)}
          onCancel={closeEdit}
          saving={saving}
          error={error}
          addOption={addOption}
          updateOption={updateOption}
          removeOption={removeOption}
          moveOption={moveOption}
        />
      )}

      {/* Question list */}
      {sorted.map((q, idx) => {
        const isExpanded = expandedId === q.id;
        const catStyle = CATEGORY_COLORS[q.category ?? ""] ?? "bg-gray-700 text-gray-400 border-gray-600";
        return (
          <div key={q.id} className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
            {/* Row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveQuestion(q, -1)}
                  disabled={reordering || idx === 0}
                  className="text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => moveQuestion(q, 1)}
                  disabled={reordering || idx === sorted.length - 1}
                  className="text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{q.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {q.category && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catStyle}`}>
                      {q.category}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-600 font-mono">{q.slug}</span>
                  {!q.active && <span className="text-[10px] text-red-400 font-medium">Inactive</span>}
                  {q.hidden && <span className="text-[10px] text-amber-400 font-medium">Hidden</span>}
                  <span className="text-[10px] text-gray-700">{q.options.length} opts</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => isExpanded ? closeEdit() : openEdit(q)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isExpanded
                      ? "bg-gray-700 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {isExpanded ? "Close" : "Edit"}
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  disabled={deleting === q.id}
                  className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {deleting === q.id ? (
                    <span className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Edit form */}
            {isExpanded && (
              <div className="border-t border-gray-800 px-4 py-4">
                <QuestionForm
                  form={form}
                  setForm={setForm}
                  showSlug={false}
                  onSave={() => handleSave(q)}
                  onCancel={closeEdit}
                  saving={saving}
                  error={error}
                  addOption={addOption}
                  updateOption={updateOption}
                  removeOption={removeOption}
                  moveOption={moveOption}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Inline form component ─────────────────────────────────────────────────
function QuestionForm({
  form, setForm, slug, setSlug, showSlug,
  onSave, onCancel, saving, error,
  addOption, updateOption, removeOption, moveOption,
}: {
  form: EditForm;
  setForm: (f: EditForm) => void;
  slug?: string;
  setSlug?: (s: string) => void;
  showSlug: boolean;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  addOption: () => void;
  updateOption: (i: number, p: Partial<SadhanaOption>) => void;
  removeOption: (i: number) => void;
  moveOption: (i: number, dir: -1 | 1) => void;
}) {
  return (
    <div className="space-y-4 bg-gray-950/60 rounded-xl p-4 border border-gray-800">
      {/* Slug (new question only) */}
      {showSlug && (
        <div>
          <label className="block text-xs text-gray-500 mb-1 font-medium">Slug (unique key, no spaces)</label>
          <input
            value={slug ?? ""}
            onChange={(e) => setSlug?.(e.target.value.replace(/\s/g, ""))}
            placeholder="e.g. japaRounds"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/60"
          />
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs text-gray-500 mb-1 font-medium">Title</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Question text"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/60"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-gray-500 mb-1 font-medium">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Explanation shown below the question"
          rows={2}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/60 resize-none"
        />
      </div>

      {/* Category + toggles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-32">
          <label className="block text-xs text-gray-500 mb-1 font-medium">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500/60"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="">Other</option>
          </select>
        </div>
        <div className="flex gap-3 pt-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-orange-500"
            />
            <span className="text-xs text-gray-400">Active</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hidden}
              onChange={(e) => setForm({ ...form, hidden: e.target.checked })}
              className="accent-amber-500"
            />
            <span className="text-xs text-gray-400">Hidden</span>
          </label>
        </div>
      </div>

      {/* Options */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500 font-medium">Options</label>
          <button
            onClick={addOption}
            className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
          >
            + Add Option
          </button>
        </div>
        <div className="space-y-2">
          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* Up/Down */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveOption(i, -1)} disabled={i === 0}
                  className="text-gray-600 hover:text-gray-300 disabled:opacity-20">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button onClick={() => moveOption(i, 1)} disabled={i === form.options.length - 1}
                  className="text-gray-600 hover:text-gray-300 disabled:opacity-20">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
              {/* Value */}
              <input
                value={opt.value}
                onChange={(e) => updateOption(i, { value: e.target.value })}
                placeholder="Value"
                className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500/60 flex-shrink-0"
              />
              {/* Label */}
              <input
                value={opt.label}
                onChange={(e) => updateOption(i, { label: e.target.value })}
                placeholder="Label shown to user"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500/60"
              />
              {/* Points */}
              <input
                type="number"
                value={opt.points}
                onChange={(e) => updateOption(i, { points: Number(e.target.value) })}
                className="w-14 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white text-right outline-none focus:border-orange-500/60 flex-shrink-0"
              />
              <span className="text-[9px] text-gray-600 flex-shrink-0">pts</span>
              {/* Remove */}
              <button onClick={() => removeOption(i)}
                className="text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {form.options.length === 0 && (
            <p className="text-xs text-gray-700 italic">No options yet — click "+ Add Option"</p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:text-white hover:border-gray-500 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
        >
          {saving ? "Saving…" : "Save Question"}
        </button>
      </div>
    </div>
  );
}
