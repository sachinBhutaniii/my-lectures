"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  addSection,
  updateSection,
  deleteSection,
  parseQuestions,
  saveQuestions,
  getSectionQuestions,
  deleteQuestion,
  Course,
  CourseSection,
  QuestionDto,
  parseOptions,
} from "@/services/jnana.service";

// ── View levels ──────────────────────────────────────────────────────────────
type Level = "courses" | "sections" | "questions";

export default function JnanaYagyaAdmin() {
  const [level, setLevel] = useState<Level>("courses");

  // Course level
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", coverImageUrl: "", displayOrder: 0, published: false });
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<number | null>(null);

  // Section level
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSectionLoading, setAddingSectionLoading] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<number | null>(null);

  // Question level
  const [rawText, setRawText] = useState("");
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuestionDto[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [existingQuestions, setExistingQuestions] = useState<QuestionDto[]>([]);
  const [existingTab, setExistingTab] = useState<"paste" | "existing">("paste");
  const [existingLoading, setExistingLoading] = useState(false);

  // ── Load courses ────────────────────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const list = await getCourses();
      setCourses(list);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // ── Load sections for selected course ──────────────────────────────────────
  const loadSections = useCallback(async (courseId: number) => {
    setSectionsLoading(true);
    try {
      const detail = await getCourse(courseId);
      setSections(detail.sections);
    } finally {
      setSectionsLoading(false);
    }
  }, []);

  // ── Load existing questions ─────────────────────────────────────────────────
  const loadExistingQuestions = useCallback(async (sectionId: number) => {
    setExistingLoading(true);
    try {
      const qs = await getSectionQuestions(sectionId);
      setExistingQuestions(qs);
    } finally {
      setExistingLoading(false);
    }
  }, []);

  // ── Course CRUD ─────────────────────────────────────────────────────────────
  const handleSaveCourse = async () => {
    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, courseForm);
      } else {
        await createCourse(courseForm);
      }
      setCourseForm({ title: "", description: "", coverImageUrl: "", displayOrder: 0, published: false });
      setShowNewCourse(false);
      setEditingCourse(null);
      await loadCourses();
    } catch (e) {
      alert("Failed to save course");
    }
  };

  const handleDeleteCourse = async (id: number) => {
    if (!confirm("Delete this course and all its chapters and questions?")) return;
    setDeletingCourseId(id);
    try {
      await deleteCourse(id);
      await loadCourses();
    } finally {
      setDeletingCourseId(null);
    }
  };

  const openEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseForm({
      title: course.title,
      description: course.description || "",
      coverImageUrl: course.coverImageUrl || "",
      displayOrder: course.displayOrder,
      published: course.published,
    });
    setShowNewCourse(true);
  };

  // ── Section CRUD ────────────────────────────────────────────────────────────
  const handleAddSection = async () => {
    if (!selectedCourse || !newSectionTitle.trim()) return;
    setAddingSectionLoading(true);
    try {
      await addSection(selectedCourse.id, newSectionTitle.trim(), sections.length);
      setNewSectionTitle("");
      await loadSections(selectedCourse.id);
    } finally {
      setAddingSectionLoading(false);
    }
  };

  const handleUpdateSection = async (sectionId: number) => {
    if (!editingSectionTitle.trim()) return;
    const section = sections.find((s) => s.id === sectionId);
    try {
      await updateSection(sectionId, editingSectionTitle.trim(), section?.displayOrder ?? 0);
      setEditingSectionId(null);
      setEditingSectionTitle("");
      if (selectedCourse) await loadSections(selectedCourse.id);
    } catch {
      alert("Failed to update section");
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    if (!confirm("Delete this chapter and all its questions?")) return;
    setDeletingSectionId(sectionId);
    try {
      await deleteSection(sectionId);
      if (selectedCourse) await loadSections(selectedCourse.id);
    } finally {
      setDeletingSectionId(null);
    }
  };

  // ── Question parsing + saving ────────────────────────────────────────────────
  const handleParse = async () => {
    if (!selectedSection || !rawText.trim()) return;
    setParseLoading(true);
    setParseError(null);
    try {
      const parsed = await parseQuestions(selectedSection.id, rawText);
      setPreview(parsed);
    } catch {
      setParseError("Failed to parse questions. Check format.");
    } finally {
      setParseLoading(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (!selectedSection || preview.length === 0) return;
    setSaveLoading(true);
    try {
      await saveQuestions(selectedSection.id, preview);
      setPreview([]);
      setRawText("");
      await loadExistingQuestions(selectedSection.id);
      if (selectedCourse) await loadSections(selectedCourse.id);
      setExistingTab("existing");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Unknown error";
      alert(`Save failed: ${msg}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm("Delete this question?")) return;
    try {
      await deleteQuestion(id);
      if (selectedSection) await loadExistingQuestions(selectedSection.id);
    } catch {
      alert("Failed to delete question");
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  const difficultyColor = (d?: string) => {
    if (d === "EASY") return "text-green-400 bg-green-500/10 border-green-500/20";
    if (d === "HARD") return "text-red-400 bg-red-500/10 border-red-500/20";
    return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  };

  const typeColor = (t?: string) => {
    if (t === "MCQ") return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    if (t === "TRUE_FALSE") return "text-purple-400 bg-purple-500/10 border-purple-500/20";
    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  };

  const typeLabel = (t?: string) => {
    if (t === "MCQ") return "MCQ";
    if (t === "TRUE_FALSE") return "T/F";
    if (t === "ASSERTION_REASONING") return "A/R";
    return t ?? "?";
  };

  // ── LEVEL: Courses ──────────────────────────────────────────────────────────
  if (level === "courses") {
    return (
      <div>
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base">Courses</h2>
          <button
            onClick={() => { setShowNewCourse(true); setEditingCourse(null); setCourseForm({ title: "", description: "", coverImageUrl: "", displayOrder: 0, published: false }); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            New Course
          </button>
        </div>

        {/* New/Edit Course form */}
        {showNewCourse && (
          <div className="mb-5 p-4 rounded-xl border border-amber-500/25 bg-[#1c1300]/60">
            <p className="text-amber-300 font-semibold text-sm mb-3">{editingCourse ? "Edit Course" : "New Course"}</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Title *"
                value={courseForm.title}
                onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
              />
              <textarea
                placeholder="Description"
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                rows={2}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
              />
              <input
                type="text"
                placeholder="Cover image URL"
                value={courseForm.coverImageUrl}
                onChange={(e) => setCourseForm({ ...courseForm, coverImageUrl: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseForm.published}
                    onChange={(e) => setCourseForm({ ...courseForm, published: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-sm text-gray-300">Published</span>
                </label>
                <input
                  type="number"
                  placeholder="Order"
                  value={courseForm.displayOrder}
                  onChange={(e) => setCourseForm({ ...courseForm, displayOrder: parseInt(e.target.value) || 0 })}
                  className="w-20 bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCourse}
                  disabled={!courseForm.title.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  {editingCourse ? "Update" : "Create"}
                </button>
                <button
                  onClick={() => { setShowNewCourse(false); setEditingCourse(null); }}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Course list */}
        {coursesLoading && (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!coursesLoading && courses.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-10">No courses yet. Create one above.</p>
        )}
        <div className="flex flex-col gap-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-xl border border-gray-800 bg-[#111] p-4"
            >
              <div className="flex items-start gap-3">
                {course.coverImageUrl && (
                  <img src={course.coverImageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium text-sm">{course.title}</p>
                    {course.published
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">Published</span>
                      : <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-500">Draft</span>
                    }
                  </div>
                  {course.description && (
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{course.description}</p>
                  )}
                  <p className="text-gray-600 text-xs mt-1">{course.sectionCount} chapter{course.sectionCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => {
                    setSelectedCourse(course);
                    setLevel("sections");
                    loadSections(course.id);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                >
                  Manage Chapters
                </button>
                <button
                  onClick={() => openEditCourse(course)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteCourse(course.id)}
                  disabled={deletingCourseId === course.id}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  {deletingCourseId === course.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── LEVEL: Sections ─────────────────────────────────────────────────────────
  if (level === "sections" && selectedCourse) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setLevel("courses")} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-base truncate">{selectedCourse.title}</h2>
            <p className="text-gray-500 text-xs">Chapters</p>
          </div>
        </div>

        {/* Add section */}
        <div className="flex gap-2 mb-5">
          <input
            type="text"
            placeholder="New chapter title…"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); }}
            className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleAddSection}
            disabled={!newSectionTitle.trim() || addingSectionLoading}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-40"
          >
            {addingSectionLoading ? "…" : "Add"}
          </button>
        </div>

        {/* Sections list */}
        {sectionsLoading && (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!sectionsLoading && sections.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No chapters yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {sections.map((section, idx) => (
            <div key={section.id} className="rounded-xl border border-gray-800 bg-[#111] p-3">
              {editingSectionId === section.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingSectionTitle}
                    onChange={(e) => setEditingSectionTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleUpdateSection(section.id); if (e.key === "Escape") setEditingSectionId(null); }}
                    autoFocus
                    className="flex-1 bg-[#0a0a0a] border border-amber-500/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                  />
                  <button onClick={() => handleUpdateSection(section.id)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-semibold">Save</button>
                  <button onClick={() => setEditingSectionId(null)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-[10px] font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{section.title}</p>
                    <p className="text-gray-600 text-xs">{section.questionCount} question{section.questionCount !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSection(section);
                      setLevel("questions");
                      setRawText("");
                      setPreview([]);
                      setParseError(null);
                      setExistingTab("paste");
                      loadExistingQuestions(section.id);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    Questions
                  </button>
                  <button
                    onClick={() => { setEditingSectionId(section.id); setEditingSectionTitle(section.title); }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    disabled={deletingSectionId === section.id}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    {deletingSectionId === section.id ? "…" : "✕"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── LEVEL: Questions ─────────────────────────────────────────────────────────
  if (level === "questions" && selectedSection) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { setLevel("sections"); if (selectedCourse) loadSections(selectedCourse.id); }} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-base truncate">{selectedSection.title}</h2>
            <p className="text-gray-500 text-xs">{selectedSection.questionCount} questions saved</p>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 mb-4 border-b border-gray-800">
          <button
            onClick={() => setExistingTab("paste")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${existingTab === "paste" ? "border-amber-500 text-amber-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}
          >
            Paste &amp; Parse
          </button>
          <button
            onClick={() => { setExistingTab("existing"); loadExistingQuestions(selectedSection.id); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${existingTab === "existing" ? "border-amber-500 text-amber-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}
          >
            Saved Questions
          </button>
        </div>

        {/* Paste & Parse tab */}
        {existingTab === "paste" && (
          <div>
            {/* Format hint */}
            <details className="mb-3">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 select-none">Format guide ▾</summary>
              <pre className="mt-2 text-[10px] text-gray-600 bg-[#0a0a0a] rounded-lg p-3 leading-relaxed overflow-x-auto whitespace-pre-wrap">{`1. Question text here
A) Option A  B) Option B  C) Option C  D) Option D
Answer: B  |  Difficulty: Medium  |  Source: BG 2.20  |  Type: MCQ

2. (True/False) Statement text
Answer: True  |  Difficulty: Easy  |  Source: SB 1.1.1

3. Assertion: assertion text  Reason: reason text
A) Both correct, Reason explains Assertion
B) Both correct, Reason doesn't explain
C) Assertion correct, Reason wrong
D) Both wrong
Answer: A  |  Difficulty: Hard  |  Source: BG 9.15`}</pre>
            </details>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your questions here…"
              rows={12}
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-amber-500 font-mono resize-y"
            />

            {parseError && (
              <p className="text-red-400 text-xs mt-2">{parseError}</p>
            )}

            <button
              onClick={handleParse}
              disabled={!rawText.trim() || parseLoading}
              className="mt-3 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold text-sm transition-colors disabled:opacity-40"
            >
              {parseLoading ? "Parsing…" : "Parse Questions"}
            </button>

            {/* Preview */}
            {preview.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-semibold text-sm">{preview.length} questions parsed</p>
                  <button
                    onClick={handleSaveQuestions}
                    disabled={saveLoading}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    {saveLoading ? "Saving…" : `Save ${preview.length} Questions`}
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {preview.map((q, i) => (
                    <QuestionCard key={i} q={q} index={i} typeColor={typeColor} typeLabel={typeLabel} difficultyColor={difficultyColor} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Saved Questions tab */}
        {existingTab === "existing" && (
          <div>
            {existingLoading && (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!existingLoading && existingQuestions.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-10">No questions saved yet.</p>
            )}
            <div className="flex flex-col gap-3">
              {existingQuestions.map((q, i) => (
                <div key={q.id ?? i} className="relative">
                  <QuestionCard q={q} index={i} typeColor={typeColor} typeLabel={typeLabel} difficultyColor={difficultyColor} />
                  {q.id && (
                    <button
                      onClick={() => handleDeleteQuestion(q.id!)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-center hover:bg-red-500/20 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Shared QuestionCard ───────────────────────────────────────────────────────
function QuestionCard({
  q,
  index,
  typeColor,
  typeLabel,
  difficultyColor,
}: {
  q: QuestionDto;
  index: number;
  typeColor: (t?: string) => string;
  typeLabel: (t?: string) => string;
  difficultyColor: (d?: string) => string;
}) {
  const options = parseOptions(q.optionsJson);

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-600 text-xs font-mono">#{index + 1}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${typeColor(q.type)}`}>
          {typeLabel(q.type)}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${difficultyColor(q.difficulty)}`}>
          {q.difficulty ?? "MEDIUM"}
        </span>
        {q.source && (
          <span className="text-[10px] text-gray-500 ml-auto">{q.source}</span>
        )}
      </div>
      <p className="text-white text-sm leading-relaxed mb-2">{q.questionText}</p>
      {options.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {options.map((opt) => (
            <div
              key={opt.key}
              className={`flex gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                opt.key === q.correctAnswer
                  ? "bg-green-500/10 border border-green-500/20 text-green-300"
                  : "bg-[#1a1a1a] text-gray-400"
              }`}
            >
              <span className="font-bold">{opt.key})</span>
              <span>{opt.text}</span>
            </div>
          ))}
        </div>
      )}
      {q.type === "TRUE_FALSE" && q.correctAnswer && (
        <p className="text-green-400 text-xs font-semibold">Answer: {q.correctAnswer}</p>
      )}
      {q.assertionText && (
        <p className="text-gray-400 text-xs mt-1"><span className="text-amber-500 font-semibold">Assertion:</span> {q.assertionText}</p>
      )}
      {q.reasonText && (
        <p className="text-gray-400 text-xs mt-0.5"><span className="text-amber-500 font-semibold">Reason:</span> {q.reasonText}</p>
      )}
    </div>
  );
}
