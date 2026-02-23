"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getCourses,
  getCourse,
  Course,
  CourseSection,
} from "@/services/jnana.service";

// ── View levels ──────────────────────────────────────────────────────────────
type View = "courses" | "sections" | "quiz-placeholder";

export default function JnanaYagyaPage() {
  const router = useRouter();

  const [view, setView] = useState<View>("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(null);

  // Load published courses on mount
  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(() => setError("Failed to load courses"))
      .finally(() => setLoading(false));
  }, []);

  const openCourse = useCallback(async (course: Course) => {
    setSelectedCourse(course);
    setSectionsLoading(true);
    setView("sections");
    try {
      const detail = await getCourse(course.id);
      setSections(detail.sections);
    } catch {
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  }, []);

  const openSection = useCallback((section: CourseSection) => {
    setSelectedSection(section);
    setView("quiz-placeholder");
  }, []);

  // ── Course list ──────────────────────────────────────────────────────────
  if (view === "courses") {
    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-amber-900/30">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" className="w-4 h-4">
              <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-none">Jñāna Yajña</h1>
            <p className="text-amber-700 text-[10px] tracking-widest uppercase">Sacrifice of Knowledge</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pt-5">
          {loading && (
            <div className="flex justify-center pt-16">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center pt-12">{error}</p>
          )}
          {!loading && !error && courses.length === 0 && (
            <div className="text-center pt-16">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" className="w-12 h-12 mx-auto mb-4 opacity-30">
                <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
              </svg>
              <p className="text-gray-400 text-sm">No courses available yet.</p>
              <p className="text-gray-600 text-xs mt-1 italic">
                "jñāna-yajñena cāpy anye yajanto mām upāsate" — BG 9.15
              </p>
            </div>
          )}
          {!loading && courses.length > 0 && (
            <div className="flex flex-col gap-3">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => openCourse(course)}
                  className="w-full text-left rounded-2xl border border-amber-500/15 bg-gradient-to-br from-[#1c1300] to-[#110d00] overflow-hidden active:scale-[0.98] transition-all"
                >
                  {course.coverImageUrl && (
                    <img
                      src={course.coverImageUrl}
                      alt={course.title}
                      className="w-full h-36 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-amber-200 font-semibold text-sm leading-snug">{course.title}</h2>
                      <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400">
                        {course.sectionCount} {course.sectionCount === 1 ? "chapter" : "chapters"}
                      </span>
                    </div>
                    {course.description && (
                      <p className="text-gray-400 text-xs mt-1.5 leading-relaxed line-clamp-2">
                        {course.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Section list ─────────────────────────────────────────────────────────
  if (view === "sections" && selectedCourse) {
    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-amber-900/30">
          <button onClick={() => setView("courses")} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight truncate">{selectedCourse.title}</h1>
            <p className="text-amber-700 text-[10px] uppercase tracking-widest">Select a chapter</p>
          </div>
        </div>

        <div className="px-4 pt-5">
          {sectionsLoading && (
            <div className="flex justify-center pt-12">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!sectionsLoading && sections.length === 0 && (
            <p className="text-gray-500 text-sm text-center pt-12">No chapters yet.</p>
          )}
          {!sectionsLoading && sections.length > 0 && (
            <div className="flex flex-col gap-2">
              {sections.map((section, idx) => (
                <button
                  key={section.id}
                  onClick={() => openSection(section)}
                  className="w-full text-left flex items-center gap-4 px-4 py-4 rounded-xl border border-amber-500/10 bg-[#1c1300]/60 hover:border-amber-500/30 active:scale-[0.98] transition-all"
                >
                  <span className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-100 text-sm font-medium leading-snug">{section.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {section.questionCount} {section.questionCount === 1 ? "question" : "questions"}
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-amber-600 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Quiz placeholder ─────────────────────────────────────────────────────
  if (view === "quiz-placeholder" && selectedSection) {
    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-amber-900/30">
          <button onClick={() => setView("sections")} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight truncate">{selectedSection.title}</h1>
            <p className="text-amber-700 text-[10px] uppercase tracking-widest">Quiz</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-6 pt-24 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" className="w-8 h-8">
              <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
            </svg>
          </div>
          <div>
            <p className="text-amber-300 font-semibold text-lg">{selectedSection.title}</p>
            <p className="text-gray-500 text-sm mt-1">
              {selectedSection.questionCount} {selectedSection.questionCount === 1 ? "question" : "questions"}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/15 bg-[#1c1300]/60 px-5 py-4 max-w-xs">
            <p className="text-gray-300 text-sm leading-relaxed">
              Quiz mode coming soon. Questions for this chapter are ready — the interactive quiz experience is being prepared.
            </p>
          </div>
          <p className="text-gray-600 text-xs italic">
            "jñāna-yajñena cāpy anye yajanto mām upāsate" — BG 9.15
          </p>
        </div>
      </div>
    );
  }

  return null;
}
