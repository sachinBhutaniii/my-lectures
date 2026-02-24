"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getCourses,
  getCourse,
  getSectionQuestions,
  Course,
  CourseSection,
  QuestionDto,
  parseOptions,
} from "@/services/jnana.service";
import { useJnanaProgress, LevelResult } from "@/hooks/useJnanaProgress";

// ── Types ─────────────────────────────────────────────────────────────────────
type View =
  | "courses"
  | "sections"
  | "quiz-levels"
  | "quiz-rules"
  | "quiz-active"
  | "quiz-results"
  | "quiz-reattempt"
  | "quiz-reattempt-results"
  | "course-complete";

interface QuestionAttempt {
  questionId: number;
  selectedAnswer: string | null; // option key (A/B/C/D / "True" / "False") or null = timed out
  isCorrect: boolean;
  hintUsed: boolean;
  hintWasComplimentary: boolean;
  timedOut: boolean;
  pointsEarned: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LEVEL_NAMES = ["Shravana", "Manana", "Nididhyasana", "Vairagya", "Tattva-Darshi"];
const LEVEL_SUBTITLES = [
  "Hearing — Open your heart to sacred knowledge",
  "Reflection — Contemplate deeply what you have heard",
  "Meditation — Let wisdom settle into your very being",
  "Renunciation — Rise above with unwavering clarity",
  "Seer of Truth — The knower stands victorious",
];
const TIMER_SECS = 40;
const GURUDEV_MESSAGES = [
  "You have completed the Jñāna Yajña with great sincerity. This knowledge is now your eternal companion on the path back to Godhead. Haribol!",
  "By this sacrifice of knowledge you have pleased Śrīla Prabhupāda and the entire paramparā. Let every answer become a lamp in your devotional life.",
  "Śrī Kṛṣṇa says — jñāna-yajñena cāpy anye yajanto mām upāsate. You have worshipped Him today. May your bhakti never waver.",
];

// ── Pure helpers ──────────────────────────────────────────────────────────────
function computeQuizLevels(questions: QuestionDto[]): QuestionDto[][] {
  if (!questions.length) return [];
  const sorted = [...questions].sort((a, b) => {
    const o: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };
    return (o[a.difficulty] ?? 1) - (o[b.difficulty] ?? 1);
  });
  const n = Math.min(5, Math.max(2,
    sorted.length < 16 ? 2 :
    sorted.length < 25 ? 3 :
    sorted.length < 33 ? 4 : 5
  ));
  const size = Math.ceil(sorted.length / n);
  return Array.from({ length: n }, (_, i) => sorted.slice(i * size, (i + 1) * size));
}

function getLevelName(idx: number, total: number): string {
  if (idx === 0) return LEVEL_NAMES[0];
  if (idx === total - 1) return LEVEL_NAMES[4];
  return LEVEL_NAMES[idx] ?? `Level ${idx + 1}`;
}

function getLevelSubtitle(idx: number, total: number): string {
  if (idx === 0) return LEVEL_SUBTITLES[0];
  if (idx === total - 1) return LEVEL_SUBTITLES[4];
  return LEVEL_SUBTITLES[idx] ?? "";
}

function calcPoints(correct: boolean, hintUsed: boolean, isComplimentary: boolean): number {
  if (!correct) return 0;
  if (hintUsed && !isComplimentary) return 1;
  return 2;
}

function isAnswerCorrect(key: string, correctAnswer: string): boolean {
  const ca = (correctAnswer ?? "").trim();
  return key === ca || key.toLowerCase() === ca.toLowerCase();
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);
const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" className="w-5 h-5">
    <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
  </svg>
);
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

// ── Shared sub-components ─────────────────────────────────────────────────────
function PageHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-amber-900/30 sticky top-0 bg-[#1a1208] z-10">
      <button onClick={onBack} className="text-gray-400 hover:text-white p-1">
        <ChevronLeft />
      </button>
      <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
        <BookIcon />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-white font-bold text-base leading-tight truncate">{title}</h1>
        <p className="text-amber-700 text-[10px] tracking-widest uppercase">{subtitle}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center pt-16">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Timer circle ──────────────────────────────────────────────────────────────
function TimerCircle({ timeLeft }: { timeLeft: number }) {
  const pct = (timeLeft / TIMER_SECS) * 100;
  const color = timeLeft <= 10 ? "#ef4444" : timeLeft <= 20 ? "#f97316" : "#22c55e";
  const r = 15.9;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#1c1300" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{timeLeft}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JnanaYagyaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const progress = useJnanaProgress();

  // ── View routing ──────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("courses");

  // ── Course list ───────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Selected course + sections ────────────────────────────────────────────
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // ── Selected section + levels ─────────────────────────────────────────────
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(null);
  const [computedLevels, setComputedLevels] = useState<QuestionDto[][]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  // ── Quiz navigation ───────────────────────────────────────────────────────
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0);

  // ── Active quiz state ─────────────────────────────────────────────────────
  const [quizQuestions, setQuizQuestions] = useState<QuestionDto[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECS);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [hintsUsedThisQuiz, setHintsUsedThisQuiz] = useState(0);
  const [hintUsedForCurrentQ, setHintUsedForCurrentQ] = useState(false);
  const [hintComplimentaryForCurrentQ, setHintComplimentaryForCurrentQ] = useState(false);
  const [showHintConfirm, setShowHintConfirm] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [attempts, setAttempts] = useState<QuestionAttempt[]>([]);
  const [isReattempt, setIsReattempt] = useState(false);

  // ── First-attempt data (for reattempt scoring) ────────────────────────────
  const [firstAttemptScore, setFirstAttemptScore] = useState(0);
  const [firstAttemptMaxScore, setFirstAttemptMaxScore] = useState(0);
  const [firstAttemptAttempts, setFirstAttemptAttempts] = useState<QuestionAttempt[]>([]);

  // ── Reattempt results ─────────────────────────────────────────────────────
  const [reattemptAttempts, setReattemptAttempts] = useState<QuestionAttempt[]>([]);

  // ── Stale-closure-safe ref for timer callbacks ────────────────────────────
  const qRef = useRef({
    qIdx: 0,
    quizQuestions: [] as QuestionDto[],
    answered: false,
    attempts: [] as QuestionAttempt[],
    hintsUsedThisQuiz: 0,
    hintUsedForCurrentQ: false,
    hintComplimentaryForCurrentQ: false,
    isReattempt: false,
    selectedSection: null as CourseSection | null,
    selectedLevelIdx: 0,
    firstAttemptScore: 0,
    firstAttemptMaxScore: 0,
  });
  // Always keep ref in sync (runs before effects)
  qRef.current = {
    qIdx, quizQuestions, answered, attempts,
    hintsUsedThisQuiz, hintUsedForCurrentQ, hintComplimentaryForCurrentQ,
    isReattempt, selectedSection, selectedLevelIdx,
    firstAttemptScore, firstAttemptMaxScore,
  };

  // ── Gift message (stable per course completion) ───────────────────────────
  const giftIdx = useRef(0);

  // ── Load courses ──────────────────────────────────────────────────────────
  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(() => setLoadError("Failed to load courses"))
      .finally(() => setLoading(false));
  }, []);

  // ── Timer countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "quiz-active" && view !== "quiz-reattempt") return;
    if (answered || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, view, answered]);

  // ── Auto-submit on timeout ────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft !== 0) return;
    if (view !== "quiz-active" && view !== "quiz-reattempt") return;
    const ref = qRef.current;
    if (ref.answered) return;
    const q = ref.quizQuestions[ref.qIdx];
    if (!q) return;
    const attempt: QuestionAttempt = {
      questionId: q.id!,
      selectedAnswer: null,
      isCorrect: false,
      hintUsed: ref.hintUsedForCurrentQ,
      hintWasComplimentary: ref.hintComplimentaryForCurrentQ,
      timedOut: true,
      pointsEarned: 0,
    };
    setAnswered(true);
    setAttempts(prev => [...prev, attempt]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── Action: open course ───────────────────────────────────────────────────
  const openCourse = useCallback(async (course: Course) => {
    setSelectedCourse(course);
    setSectionsLoading(true);
    setView("sections");
    setSections([]);
    try {
      const detail = await getCourse(course.id);
      setSections(detail.sections);
      progress.saveSectionIds(course.id, detail.sections.map(s => s.id));
    } catch {
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  }, [progress]);

  // ── Action: open section (load questions, compute levels) ─────────────────
  const openSection = useCallback(async (section: CourseSection) => {
    setSelectedSection(section);
    setComputedLevels([]);
    setQuestionsError(null);
    setQuestionsLoading(true);
    setView("quiz-levels");
    try {
      const questions = await getSectionQuestions(section.id);
      const levels = computeQuizLevels(questions);
      setComputedLevels(levels);
      progress.saveLevelCount(section.id, levels.length);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setQuestionsError(
        status === 403
          ? "Quiz access requires admin privileges. Please contact the administrator."
          : "Failed to load questions. Please try again."
      );
    } finally {
      setQuestionsLoading(false);
    }
  }, [progress]);

  // ── Action: choose level → rules screen ──────────────────────────────────
  const openLevel = useCallback((levelIdx: number) => {
    setSelectedLevelIdx(levelIdx);
    setView("quiz-rules");
  }, []);

  // ── Action: start quiz from rules screen ─────────────────────────────────
  const startQuiz = useCallback(() => {
    const qs = computedLevels[selectedLevelIdx] ?? [];
    setQuizQuestions(qs);
    setQIdx(0);
    setTimeLeft(TIMER_SECS);
    setSelectedOpt(null);
    setAnswered(false);
    setHintsUsedThisQuiz(0);
    setHintUsedForCurrentQ(false);
    setHintComplimentaryForCurrentQ(false);
    setShowHintConfirm(false);
    setHintRevealed(false);
    setAttempts([]);
    setIsReattempt(false);
    setView("quiz-active");
  }, [computedLevels, selectedLevelIdx]);

  // ── Action: select answer ─────────────────────────────────────────────────
  const handleSelectAnswer = useCallback((key: string) => {
    const ref = qRef.current;
    if (ref.answered) return;
    const q = ref.quizQuestions[ref.qIdx];
    if (!q) return;
    const correct = isAnswerCorrect(key, q.correctAnswer ?? "");
    const points = calcPoints(correct, ref.hintUsedForCurrentQ, ref.hintComplimentaryForCurrentQ);
    const attempt: QuestionAttempt = {
      questionId: q.id!,
      selectedAnswer: key,
      isCorrect: correct,
      hintUsed: ref.hintUsedForCurrentQ,
      hintWasComplimentary: ref.hintComplimentaryForCurrentQ,
      timedOut: false,
      pointsEarned: points,
    };
    setSelectedOpt(key);
    setAnswered(true);
    setAttempts(prev => [...prev, attempt]);
  }, []);

  // ── Action: confirm hint use ──────────────────────────────────────────────
  const handleUseHint = useCallback(() => {
    setShowHintConfirm(false);
    const isComplimentary = qRef.current.hintsUsedThisQuiz === 0;
    setHintsUsedThisQuiz(p => p + 1);
    setHintUsedForCurrentQ(true);
    setHintComplimentaryForCurrentQ(isComplimentary);
    setHintRevealed(true);
  }, []);

  // ── Action: finalize quiz (called from handleNext) ────────────────────────
  const finalizeQuiz = useCallback((finalAttempts: QuestionAttempt[]) => {
    const ref = qRef.current;
    const score = finalAttempts.reduce((s, a) => s + a.pointsEarned, 0);

    if (ref.isReattempt) {
      const combined = ref.firstAttemptScore + score;
      const passed = combined >= ref.firstAttemptMaxScore * 0.5;
      if (ref.selectedSection) {
        progress.saveLevelResult(ref.selectedSection.id, ref.selectedLevelIdx, {
          score: combined,
          maxScore: ref.firstAttemptMaxScore,
          passed,
          completed: true,
          attemptedAt: new Date().toISOString(),
        });
      }
      setReattemptAttempts(finalAttempts);
      setAttempts(finalAttempts);
      setView("quiz-reattempt-results");
    } else {
      const maxScore = finalAttempts.length * 2;
      const passed = score >= maxScore * 0.5;
      if (ref.selectedSection) {
        progress.saveLevelResult(ref.selectedSection.id, ref.selectedLevelIdx, {
          score,
          maxScore,
          passed,
          completed: true,
          attemptedAt: new Date().toISOString(),
        });
      }
      setFirstAttemptScore(score);
      setFirstAttemptMaxScore(maxScore);
      setFirstAttemptAttempts(finalAttempts);
      setAttempts(finalAttempts);
      setView("quiz-results");
    }
  }, [progress]);

  // ── Action: next question ─────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    const ref = qRef.current;
    const nextIdx = ref.qIdx + 1;
    if (nextIdx >= ref.quizQuestions.length) {
      finalizeQuiz(ref.attempts);
    } else {
      setQIdx(nextIdx);
      setSelectedOpt(null);
      setAnswered(false);
      setTimeLeft(TIMER_SECS);
      setHintUsedForCurrentQ(false);
      setHintComplimentaryForCurrentQ(false);
      setHintRevealed(false);
    }
  }, [finalizeQuiz]);

  // ── Action: start reattempt ───────────────────────────────────────────────
  const startReattempt = useCallback(() => {
    const wrongQIds = new Set(firstAttemptAttempts.filter(a => !a.isCorrect).map(a => a.questionId));
    const wrongQs = computedLevels[selectedLevelIdx]?.filter(q => wrongQIds.has(q.id!)) ?? [];
    setQuizQuestions(wrongQs);
    setQIdx(0);
    setTimeLeft(TIMER_SECS);
    setSelectedOpt(null);
    setAnswered(false);
    setHintsUsedThisQuiz(0);
    setHintUsedForCurrentQ(false);
    setHintComplimentaryForCurrentQ(false);
    setShowHintConfirm(false);
    setHintRevealed(false);
    setAttempts([]);
    setIsReattempt(true);
    setView("quiz-reattempt");
  }, [firstAttemptAttempts, computedLevels, selectedLevelIdx]);

  // ── Action: go to next level ──────────────────────────────────────────────
  const goToNextLevel = useCallback(() => {
    const nextIdx = selectedLevelIdx + 1;
    setSelectedLevelIdx(nextIdx);
    setView("quiz-rules");
  }, [selectedLevelIdx]);

  // ── Action: check if course complete and go to certificate ────────────────
  const checkAndShowCertificate = useCallback(() => {
    if (!selectedCourse) return;
    if (progress.isCourseCompleted(selectedCourse.id)) {
      giftIdx.current = Math.floor(Math.random() * GURUDEV_MESSAGES.length);
      setView("course-complete");
    } else {
      setView("sections");
    }
  }, [selectedCourse, progress]);

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: COURSES
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "courses") {
    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-5 border-b border-amber-900/30">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white p-1">
            <ChevronLeft />
          </button>
          <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <BookIcon />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-none">Jñāna Yajña</h1>
            <p className="text-amber-700 text-[10px] tracking-widest uppercase mt-0.5">Sacrifice of Knowledge</p>
          </div>
        </div>

        {/* Intro banner */}
        <div className="mx-4 mt-5 mb-4 rounded-2xl bg-gradient-to-br from-amber-900/20 to-[#1c1300] border border-amber-500/20 px-5 py-4">
          <p className="text-amber-300 text-xs leading-relaxed italic">
            "jñāna-yajñena cāpy anye yajanto mām upāsate" — BG 9.15
          </p>
          <p className="text-gray-400 text-xs mt-2 leading-relaxed">
            Complete quizzes to earn points, unlock levels, and receive a completion certificate from Srila Gurudev upon finishing a course.
          </p>
        </div>

        <div className="px-4">
          {loading && <Spinner />}
          {loadError && <p className="text-red-400 text-sm text-center pt-12">{loadError}</p>}
          {!loading && !loadError && courses.length === 0 && (
            <div className="text-center pt-16">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <BookIcon />
              </div>
              <p className="text-gray-400 text-sm">No courses available yet.</p>
            </div>
          )}

          {!loading && courses.length > 0 && (
            <div className="flex flex-col gap-4">
              {courses.map((course) => {
                const pct = progress.getCourseProgressPercent(course.id);
                const done = progress.isCourseCompleted(course.id);
                return (
                  <button
                    key={course.id}
                    onClick={() => openCourse(course)}
                    className="w-full text-left rounded-2xl border border-amber-500/15 bg-gradient-to-br from-[#1c1300] to-[#110d00] overflow-hidden active:scale-[0.98] transition-all"
                  >
                    {course.coverImageUrl && (
                      <div className="relative">
                        <img src={course.coverImageUrl} alt={course.title} className="w-full h-40 object-cover" />
                        {done && (
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            Completed
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h2 className="text-amber-200 font-bold text-sm leading-snug">{course.title}</h2>
                        <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400">
                          {course.sectionCount} {course.sectionCount === 1 ? "chapter" : "chapters"}
                        </span>
                      </div>
                      {course.description && (
                        <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">
                          {course.description}
                        </p>
                      )}
                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-gray-500">Progress</span>
                          <span className="text-[10px] font-bold text-amber-400">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-amber-900/30 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {done && (
                        <div className="mt-3 flex items-center gap-2 text-amber-300 text-xs font-medium">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.24a1 1 0 000 1.96l1.192.24a1 1 0 01.785.785l.24 1.192a1 1 0 001.96 0l.24-1.192a1 1 0 01.785-.785l1.192-.24a1 1 0 000-1.96l-1.192-.24a1 1 0 01-.785-.785l-.24-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684z" />
                          </svg>
                          Certificate earned — View
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: SECTIONS (chapters)
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "sections" && selectedCourse) {
    const courseComplete = selectedCourse ? progress.isCourseCompleted(selectedCourse.id) : false;
    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        <PageHeader
          title={selectedCourse.title}
          subtitle="Select a chapter"
          onBack={() => setView("courses")}
        />

        {/* Course progress bar */}
        {!sectionsLoading && sections.length > 0 && (
          <div className="mx-4 mt-5 mb-1 rounded-xl border border-amber-500/15 bg-[#1c1300]/60 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Overall Progress</span>
              <span className="text-xs font-bold text-amber-400">
                {progress.getCourseProgressPercent(selectedCourse.id)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-amber-900/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700"
                style={{ width: `${progress.getCourseProgressPercent(selectedCourse.id)}%` }}
              />
            </div>
            {courseComplete && (
              <button
                onClick={() => { giftIdx.current = Math.floor(Math.random() * GURUDEV_MESSAGES.length); setView("course-complete"); }}
                className="mt-3 w-full py-2 rounded-lg bg-amber-500 text-black text-xs font-bold flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.24a1 1 0 000 1.96l1.192.24a1 1 0 01.785.785l.24 1.192a1 1 0 001.96 0l.24-1.192a1 1 0 01.785-.785l1.192-.24a1 1 0 000-1.96l-1.192-.24a1 1 0 01-.785-.785l-.24-1.192z" />
                </svg>
                View Certificate &amp; Gift
              </button>
            )}
          </div>
        )}

        <div className="px-4 pt-4">
          {sectionsLoading && <Spinner />}
          {!sectionsLoading && sections.length === 0 && (
            <p className="text-gray-500 text-sm text-center pt-12">No chapters yet.</p>
          )}
          {!sectionsLoading && sections.length > 0 && (
            <div className="flex flex-col gap-3">
              {sections.map((section, idx) => {
                const numLevels = progress.getLevelCount(section.id);
                const levelResults: (LevelResult | null)[] = Array.from({ length: numLevels }, (_, i) =>
                  progress.getLevelResult(section.id, i)
                );
                const passedCount = levelResults.filter(r => r?.passed).length;
                const allPassed = passedCount === numLevels;

                return (
                  <button
                    key={section.id}
                    onClick={() => openSection(section)}
                    className="w-full text-left flex items-center gap-4 px-4 py-4 rounded-2xl border border-amber-500/10 bg-[#1c1300]/60 hover:border-amber-500/30 active:scale-[0.98] transition-all"
                  >
                    <span className="w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: allPassed ? "rgba(251,191,36,0.15)" : "rgba(251,191,36,0.06)",
                        borderColor: allPassed ? "rgba(251,191,36,0.4)" : "rgba(251,191,36,0.15)",
                        color: allPassed ? "#fbbf24" : "#a16207"
                      }}>
                      {allPassed ? "✓" : idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-amber-100 text-sm font-semibold leading-snug">{section.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {/* Level dots */}
                        <div className="flex gap-1">
                          {Array.from({ length: numLevels }).map((_, li) => {
                            const r = levelResults[li];
                            return (
                              <span key={li} className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                  background: r?.passed ? "#fbbf24" : r?.completed ? "#f97316" : "rgba(251,191,36,0.15)",
                                  border: r?.passed ? "none" : "1px solid rgba(251,191,36,0.2)"
                                }} />
                            );
                          })}
                        </div>
                        <span className="text-gray-500 text-[10px]">
                          {passedCount}/{numLevels} levels passed
                        </span>
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-amber-700 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: QUIZ LEVELS
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "quiz-levels" && selectedSection) {
    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        <PageHeader
          title={selectedSection.title}
          subtitle="Choose a level"
          onBack={() => setView("sections")}
        />

        <div className="px-4 pt-5">
          {questionsLoading && <Spinner />}
          {questionsError && (
            <div className="text-center pt-12 px-4">
              <p className="text-red-400 text-sm">{questionsError}</p>
            </div>
          )}
          {!questionsLoading && !questionsError && computedLevels.length === 0 && (
            <p className="text-gray-500 text-sm text-center pt-12">No questions available yet.</p>
          )}

          {!questionsLoading && !questionsError && computedLevels.length > 0 && (
            <div className="flex flex-col gap-3">
              {computedLevels.map((levelQs, li) => {
                const total = computedLevels.length;
                const name = getLevelName(li, total);
                const subtitle = getLevelSubtitle(li, total);
                const result = progress.getLevelResult(selectedSection.id, li);
                const prevResult = li > 0 ? progress.getLevelResult(selectedSection.id, li - 1) : null;
                const locked = li > 0 && !prevResult?.passed;
                const numQs = levelQs.length;
                const totalTime = numQs * TIMER_SECS;
                const mins = Math.floor(totalTime / 60);
                const secs = totalTime % 60;

                return (
                  <button
                    key={li}
                    onClick={() => !locked && openLevel(li)}
                    disabled={locked}
                    className={`w-full text-left rounded-2xl border px-5 py-4 transition-all active:scale-[0.98] ${
                      locked
                        ? "border-gray-800 bg-[#0e0e0e] opacity-50 cursor-not-allowed"
                        : result?.passed
                        ? "border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-[#1c1300]"
                        : "border-amber-500/15 bg-[#1c1300]/60 hover:border-amber-500/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Level badge */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        result?.passed
                          ? "bg-amber-500/20 border border-amber-500/40"
                          : locked
                          ? "bg-gray-800 border border-gray-700"
                          : "bg-amber-500/10 border border-amber-500/20"
                      }`}>
                        {locked
                          ? <LockIcon />
                          : result?.passed
                          ? <span className="text-amber-400 font-bold text-sm">✓</span>
                          : <span className="text-amber-500 font-bold text-sm">{li + 1}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-bold text-sm ${locked ? "text-gray-600" : "text-amber-200"}`}>{name}</p>
                          {result?.passed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">PASSED</span>
                          )}
                          {result?.completed && !result.passed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">FAILED</span>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 ${locked ? "text-gray-700" : "text-gray-500"}`}>{subtitle}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
                          <span>{numQs} questions</span>
                          <span>·</span>
                          <span>{mins}m {secs > 0 ? `${secs}s` : ""}</span>
                          <span>·</span>
                          <span>{numQs * 2} pts max</span>
                        </div>
                        {result && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-gray-600">Score</span>
                              <span className={`text-[10px] font-bold ${result.passed ? "text-amber-400" : "text-red-400"}`}>
                                {result.score}/{result.maxScore}
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-amber-900/30 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${result.passed ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${Math.round((result.score / result.maxScore) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {locked && (
                          <p className="text-[10px] text-gray-700 mt-1.5">Pass {getLevelName(li - 1, total)} to unlock</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: QUIZ RULES
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "quiz-rules" && selectedSection) {
    const levelName = getLevelName(selectedLevelIdx, computedLevels.length);
    const levelQs = computedLevels[selectedLevelIdx] ?? [];
    const totalTime = levelQs.length * TIMER_SECS;
    const mins = Math.floor(totalTime / 60);
    const secs = totalTime % 60;

    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        <PageHeader
          title={levelName}
          subtitle={selectedSection.title}
          onBack={() => setView("quiz-levels")}
        />

        <div className="px-5 pt-6 flex flex-col gap-5">
          {/* Quiz stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Questions", value: levelQs.length.toString() },
              { label: "Time", value: `${mins}m${secs > 0 ? ` ${secs}s` : ""}` },
              { label: "Max Score", value: `${levelQs.length * 2} pts` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-amber-500/15 bg-[#1c1300]/60 px-3 py-3 text-center">
                <p className="text-amber-200 font-bold text-base">{value}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Rules */}
          <div className="rounded-2xl border border-amber-500/15 bg-[#1c1300]/60 px-5 py-5">
            <div className="flex items-center gap-2 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#fbbf24" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 11-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM3 8a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 013 8zm11 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0114 8zm-6.94 3.94a.75.75 0 011.061 0l1.062 1.06a.75.75 0 11-1.061 1.062l-1.062-1.061a.75.75 0 010-1.061zm5.88 0a.75.75 0 010 1.06L11.878 14.06a.75.75 0 11-1.06-1.06l1.06-1.062a.75.75 0 011.061 0zM10 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 13z" clipRule="evenodd" />
              </svg>
              <p className="text-amber-300 font-bold text-sm tracking-wide uppercase">Rules of the Battlefield</p>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { n: "1", rule: "Each question carries 2 points." },
                { n: "2", rule: "2 points are awarded only when the right answer is marked on the first attempt without using a hint." },
                { n: "3", rule: "If a wrong answer is marked, the score for that question is zero." },
                { n: "4", rule: "If a hint is used, only 1 point is awarded on a correct answer." },
                { n: "5", rule: "1 Hint per quiz is complimentary — the first hint does NOT reduce your score." },
              ].map(({ n, rule }) => (
                <div key={n} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 text-[10px] font-bold flex-shrink-0 mt-0.5">{n}</span>
                  <p className="text-gray-300 text-xs leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pass threshold notice */}
          <div className="flex items-center gap-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#f97316" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <p className="text-orange-300 text-xs leading-relaxed">
              Score at least <span className="font-bold">50%</span> to unlock the next level.
            </p>
          </div>

          {/* Enter button */}
          <button
            onClick={startQuiz}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-base tracking-wide active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20"
          >
            ⚔️&nbsp; Enter the Battlefield
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: QUIZ ACTIVE (+ REATTEMPT)
  // ═════════════════════════════════════════════════════════════════════════
  if ((view === "quiz-active" || view === "quiz-reattempt") && selectedSection) {
    const currentQ = quizQuestions[qIdx];
    if (!currentQ) return null;
    const total = quizQuestions.length;
    const options = parseOptions(currentQ.optionsJson);
    const isTF = currentQ.type === "TRUE_FALSE";
    const displayOptions = isTF && !options.length
      ? [{ key: "True", text: "True" }, { key: "False", text: "False" }]
      : options;

    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-6 flex flex-col">
        {/* Quiz header */}
        <div className="px-4 pt-10 pb-3 border-b border-amber-900/20">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => {
                if (view === "quiz-reattempt") setView("quiz-results");
                else setView("quiz-rules");
              }}
              className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-1"
            >
              <ChevronLeft /> Quit
            </button>
            <span className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">
              {isReattempt ? "Re-attempt" : getLevelName(selectedLevelIdx, computedLevels.length)}
            </span>
            <span className="text-xs text-gray-500">{qIdx + 1} / {total}</span>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1 justify-center mt-1">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className="h-1 rounded-full transition-all"
                style={{
                  width: i === qIdx ? "20px" : "6px",
                  background: i < qIdx ? "#fbbf24" : i === qIdx ? "#f97316" : "rgba(251,191,36,0.15)"
                }} />
            ))}
          </div>
        </div>

        {/* Timer + Question */}
        <div className="flex-1 px-5 pt-5">
          <div className="flex items-start gap-4 mb-5">
            <TimerCircle timeLeft={timeLeft} />
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 text-amber-600">
                  {currentQ.difficulty ?? "MEDIUM"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-700 text-gray-500">
                  {currentQ.type === "TRUE_FALSE" ? "True / False" : currentQ.type === "ASSERTION_REASONING" ? "Assertion & Reason" : "MCQ"}
                </span>
              </div>
            </div>
          </div>

          {/* Assertion / Reason */}
          {currentQ.assertionText && (
            <div className="mb-3 rounded-xl bg-[#1c1300]/60 border border-amber-500/10 px-4 py-3">
              <p className="text-amber-400 text-[10px] font-bold mb-1">ASSERTION</p>
              <p className="text-gray-200 text-sm leading-relaxed">{currentQ.assertionText}</p>
              {currentQ.reasonText && (
                <>
                  <p className="text-amber-400 text-[10px] font-bold mt-2 mb-1">REASON</p>
                  <p className="text-gray-200 text-sm leading-relaxed">{currentQ.reasonText}</p>
                </>
              )}
            </div>
          )}

          <p className="text-white text-base leading-relaxed font-medium mb-5">
            {currentQ.questionText}
          </p>

          {/* Hint revealed */}
          {hintRevealed && currentQ.source && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#fbbf24" className="w-4 h-4 flex-shrink-0 mt-0.5">
                <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.544a.75.75 0 00.75.75h2.5a.75.75 0 00.75-.75v-.544c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.75 17.25a.75.75 0 001.5 0v-.5a.75.75 0 00-1.5 0v.5z" />
              </svg>
              <div>
                <p className="text-amber-400 text-[10px] font-bold mb-0.5">HINT — Source</p>
                <p className="text-amber-200 text-xs leading-relaxed">{currentQ.source}</p>
                {!hintComplimentaryForCurrentQ && (
                  <p className="text-amber-600 text-[10px] mt-1">Non-complimentary hint used — max 1 point for this question.</p>
                )}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex flex-col gap-2.5 mb-6">
            {displayOptions.map((opt) => {
              const isSelected = selectedOpt === opt.key;
              const isTimedOut = answered && !selectedOpt && opt.key === "timeout_placeholder";
              let style = "border-amber-500/10 bg-[#1c1300]/40 text-gray-300";
              if (answered && isSelected) {
                style = "border-amber-500/50 bg-amber-500/15 text-amber-200";
              } else if (answered && !isSelected) {
                style = "border-gray-800/50 bg-[#111]/40 text-gray-600 opacity-60";
              }

              return (
                <button
                  key={opt.key}
                  onClick={() => handleSelectAnswer(opt.key)}
                  disabled={answered}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all ${style} ${!answered ? "hover:border-amber-500/30 hover:bg-amber-500/8 active:scale-[0.98]" : ""}`}
                >
                  <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                    answered && isSelected
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                      : "bg-amber-500/5 border-amber-500/20 text-amber-600"
                  }`}>{opt.key}</span>
                  <span className="text-sm leading-relaxed">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Timed out message */}
          {answered && !selectedOpt && (
            <div className="mb-4 text-center rounded-xl border border-red-500/20 bg-red-500/8 py-3">
              <p className="text-red-400 text-sm font-semibold">⏱ Time&apos;s up! — Marked as incorrect</p>
            </div>
          )}
        </div>

        {/* Bottom bar: Hint + Next */}
        <div className="px-5 pb-4 flex gap-3">
          {/* Hint button */}
          {!answered && (
            <button
              onClick={() => !hintRevealed && setShowHintConfirm(true)}
              disabled={hintRevealed || !currentQ.source}
              className={`flex items-center gap-1.5 px-4 py-3 rounded-xl border text-xs font-semibold transition-colors ${
                hintRevealed || !currentQ.source
                  ? "border-gray-800 bg-[#111] text-gray-700 cursor-not-allowed"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.544a.75.75 0 00.75.75h2.5a.75.75 0 00.75-.75v-.544c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.75 17.25a.75.75 0 001.5 0v-.5a.75.75 0 00-1.5 0v.5z" />
              </svg>
              Hint
              {hintsUsedThisQuiz === 0 && !hintRevealed && currentQ.source && (
                <span className="px-1 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300">FREE</span>
              )}
            </button>
          )}
          {/* Next button */}
          {answered && (
            <button
              onClick={handleNext}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm active:scale-[0.98] transition-all"
            >
              {qIdx + 1 >= total ? "Finish Quiz →" : "Next Question →"}
            </button>
          )}
        </div>

        {/* Hint confirmation popup */}
        {showHintConfirm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm px-4 pb-8">
            <div className="w-full max-w-md rounded-2xl border border-amber-500/25 bg-[#1a1208] p-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#fbbf24" className="w-5 h-5">
                  <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.544a.75.75 0 00.75.75h2.5a.75.75 0 00.75-.75v-.544c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-base text-center mb-1">Use a Hint?</h3>
              {hintsUsedThisQuiz === 0 ? (
                <p className="text-gray-400 text-xs text-center mb-4 leading-relaxed">
                  This is your <span className="text-amber-400 font-semibold">complimentary hint</span> — it will show the question&apos;s source and will <span className="text-amber-400 font-semibold">not</span> reduce your score.
                </p>
              ) : (
                <p className="text-gray-400 text-xs text-center mb-4 leading-relaxed">
                  You have already used your complimentary hint. This hint will show the question&apos;s source but will <span className="text-red-400 font-semibold">reduce your max score to 1 point</span> for this question.
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowHintConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm">
                  Cancel
                </button>
                <button onClick={handleUseHint} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-bold">
                  Show Hint
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: QUIZ RESULTS
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "quiz-results" && selectedSection) {
    const maxScore = firstAttemptMaxScore;
    const score = firstAttemptScore;
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed = score >= maxScore * 0.5;
    const wrongAttempts = firstAttemptAttempts.filter(a => !a.isCorrect);
    const levelResult = progress.getLevelResult(selectedSection.id, selectedLevelIdx);
    const isLastLevel = selectedLevelIdx === computedLevels.length - 1;
    const nextLevelLocked = !passed; // if failed, next level still locked anyway

    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        <div className="px-4 pt-12 pb-4 border-b border-amber-900/30">
          <p className="text-amber-700 text-[10px] tracking-widest uppercase text-center mb-1">
            {getLevelName(selectedLevelIdx, computedLevels.length)} — Results
          </p>
          <h1 className="text-white font-bold text-lg text-center">{selectedSection.title}</h1>
        </div>

        <div className="px-5 pt-6 flex flex-col gap-5">
          {/* Score card */}
          <div className={`rounded-2xl border px-6 py-6 text-center ${
            passed ? "border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-[#1c1300]" : "border-red-500/20 bg-red-900/10"
          }`}>
            <div className="text-4xl font-black mb-1" style={{ color: passed ? "#fbbf24" : "#ef4444" }}>
              {score}<span className="text-xl text-gray-500">/{maxScore}</span>
            </div>
            <p className="text-gray-400 text-xs mb-3">{pct}% correct</p>
            <div className="h-2 rounded-full bg-black/30 overflow-hidden mb-3">
              <div
                className={`h-full rounded-full ${passed ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-red-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${
              passed ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {passed ? "✓ Passed" : "✗ Not Passed — Need 50%"}
            </span>
          </div>

          {/* Question review */}
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Question Review</p>
            <div className="flex flex-col gap-2">
              {firstAttemptAttempts.map((attempt, i) => {
                const q = (computedLevels[selectedLevelIdx] ?? []).find(qq => qq.id === attempt.questionId);
                return (
                  <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
                    attempt.isCorrect
                      ? "border-green-500/20 bg-green-900/10"
                      : "border-red-500/15 bg-red-900/8"
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                      attempt.isCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/15 text-red-400"
                    }`}>
                      {attempt.isCorrect ? "✓" : "✗"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-xs leading-relaxed line-clamp-2">
                        {q?.questionText ?? `Question ${i + 1}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold ${attempt.isCorrect ? "text-green-400" : "text-red-400"}`}>
                          {attempt.pointsEarned} / 2 pts
                        </span>
                        {attempt.hintUsed && (
                          <span className="text-[10px] text-amber-600">
                            {attempt.hintWasComplimentary ? "hint (free)" : "hint used"}
                          </span>
                        )}
                        {attempt.timedOut && (
                          <span className="text-[10px] text-red-600">timed out</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            {wrongAttempts.length > 0 && (
              <button
                onClick={startReattempt}
                className="w-full py-3.5 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-300 font-bold text-sm"
              >
                Re-attempt {wrongAttempts.length} wrong question{wrongAttempts.length > 1 ? "s" : ""}
              </button>
            )}
            {passed && !isLastLevel && (
              <button
                onClick={goToNextLevel}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm"
              >
                Next Level: {getLevelName(selectedLevelIdx + 1, computedLevels.length)} →
              </button>
            )}
            {passed && isLastLevel && (
              <button
                onClick={checkAndShowCertificate}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm"
              >
                ✨ Chapter Complete — View Certificate
              </button>
            )}
            <button
              onClick={() => setView("quiz-levels")}
              className="w-full py-3 rounded-xl border border-gray-800 text-gray-400 text-sm"
            >
              Back to Levels
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: REATTEMPT RESULTS
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "quiz-reattempt-results" && selectedSection) {
    const levelResult = progress.getLevelResult(selectedSection.id, selectedLevelIdx);
    const combinedScore = levelResult?.score ?? 0;
    const combinedMax = levelResult?.maxScore ?? firstAttemptMaxScore;
    const pct = combinedMax > 0 ? Math.round((combinedScore / combinedMax) * 100) : 0;
    const passed = levelResult?.passed ?? false;
    const isLastLevel = selectedLevelIdx === computedLevels.length - 1;
    const reAttemptScore = reattemptAttempts.reduce((s, a) => s + a.pointsEarned, 0);

    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        <div className="px-4 pt-12 pb-4 border-b border-amber-900/30">
          <p className="text-amber-700 text-[10px] tracking-widest uppercase text-center mb-1">Re-attempt Results</p>
          <h1 className="text-white font-bold text-lg text-center">{selectedSection.title}</h1>
        </div>

        <div className="px-5 pt-6 flex flex-col gap-5">
          {/* Combined score card */}
          <div className={`rounded-2xl border px-6 py-6 text-center ${
            passed ? "border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-[#1c1300]" : "border-red-500/20 bg-red-900/10"
          }`}>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Combined Score</p>
            <div className="text-4xl font-black mb-1" style={{ color: passed ? "#fbbf24" : "#ef4444" }}>
              {combinedScore}<span className="text-xl text-gray-500">/{combinedMax}</span>
            </div>
            <p className="text-gray-500 text-xs mb-1">
              First attempt: {firstAttemptScore} pts + Re-attempt: +{reAttemptScore} pts
            </p>
            <p className="text-gray-400 text-xs mb-3">{pct}% correct</p>
            <div className="h-2 rounded-full bg-black/30 overflow-hidden mb-3">
              <div
                className={`h-full rounded-full ${passed ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-red-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${
              passed ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {passed ? "✓ Passed" : "✗ Not Passed"}
            </span>
          </div>

          {/* Re-attempt question review */}
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Re-attempt Review</p>
            <div className="flex flex-col gap-2">
              {reattemptAttempts.map((attempt, i) => {
                const q = (computedLevels[selectedLevelIdx] ?? []).find(qq => qq.id === attempt.questionId);
                return (
                  <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
                    attempt.isCorrect ? "border-green-500/20 bg-green-900/10" : "border-red-500/15 bg-red-900/8"
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                      attempt.isCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/15 text-red-400"
                    }`}>
                      {attempt.isCorrect ? "✓" : "✗"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-xs leading-relaxed line-clamp-2">
                        {q?.questionText ?? `Question ${i + 1}`}
                      </p>
                      <span className={`text-[10px] font-bold mt-1 inline-block ${attempt.isCorrect ? "text-green-400" : "text-red-400"}`}>
                        +{attempt.pointsEarned} pts earned
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            {passed && !isLastLevel && (
              <button
                onClick={goToNextLevel}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm"
              >
                Next Level: {getLevelName(selectedLevelIdx + 1, computedLevels.length)} →
              </button>
            )}
            {passed && isLastLevel && (
              <button
                onClick={checkAndShowCertificate}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm"
              >
                ✨ Chapter Complete — View Certificate
              </button>
            )}
            <button
              onClick={() => setView("quiz-levels")}
              className="w-full py-3 rounded-xl border border-gray-800 text-gray-400 text-sm"
            >
              Back to Levels
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: COURSE COMPLETE — Certificate
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "course-complete" && selectedCourse) {
    const completionDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const userName = user?.name ?? "Dear Devotee";
    const giftMessage = GURUDEV_MESSAGES[giftIdx.current] ?? GURUDEV_MESSAGES[0];

    return (
      <div className="min-h-screen bg-[#1a1208] max-w-md mx-auto pb-24">
        <div className="px-4 pt-10 pb-4 flex items-center gap-3 border-b border-amber-900/30">
          <button onClick={() => setView("sections")} className="text-gray-400 hover:text-white p-1">
            <ChevronLeft />
          </button>
          <p className="text-amber-700 text-[10px] tracking-widest uppercase">Course Certificate</p>
        </div>

        <div className="px-5 pt-8 flex flex-col gap-6">
          {/* Certificate card */}
          <div className="relative rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-[#241a00] via-[#1c1300] to-[#0e0900] overflow-hidden">
            {/* Decorative top border */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-700 via-amber-400 to-amber-700" />

            {/* Corner ornaments */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-amber-500/40 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-500/40 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-500/40 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-amber-500/40 rounded-br-lg" />

            <div className="px-8 py-8 text-center">
              {/* Star / seal */}
              <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center mx-auto mb-5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" className="w-8 h-8">
                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                </svg>
              </div>

              <p className="text-amber-600 text-[10px] tracking-[0.2em] uppercase mb-2">Certificate of Completion</p>
              <p className="text-gray-400 text-xs mb-4">This is to certify that</p>
              <p className="text-amber-200 font-black text-xl mb-1">{userName}</p>
              <p className="text-gray-400 text-xs mb-4">has successfully completed</p>
              <p className="text-white font-bold text-base leading-snug mb-1 px-4">{selectedCourse.title}</p>
              <p className="text-gray-500 text-xs mb-5">Jñāna Yajña — Sacrifice of Knowledge</p>
              <div className="h-px bg-amber-500/20 mb-4" />
              <p className="text-amber-700 text-xs italic mb-1">Blessed on</p>
              <p className="text-amber-400 text-sm font-semibold">{completionDate}</p>
            </div>

            {/* Decorative bottom border */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-700 via-amber-400 to-amber-700" />
          </div>

          {/* Gift from Srila Gurudev */}
          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-900/15 to-[#1c1300] px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" className="w-5 h-5 flex-shrink-0">
                <path d="M9.375 3a1.875 1.875 0 000 3.75h1.875v4.5H3.375A1.875 1.875 0 011.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0112 2.753a3.375 3.375 0 015.432 3.997h3.943c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H13.5v-4.5h1.875a1.875 1.875 0 100-3.75H13.5v4.5h-3V3h-1.125z" />
                <path d="M11.25 12.75H3v6.75a2.25 2.25 0 002.25 2.25h6v-9zM12.75 12.75v9h6.75A2.25 2.25 0 0021.75 19.5v-6.75h-9z" />
              </svg>
              <p className="text-amber-400 font-bold text-xs uppercase tracking-wider">A Gift from Srila Gurudev</p>
            </div>
            <p className="text-amber-100 text-sm leading-relaxed italic">
              &ldquo;{giftMessage}&rdquo;
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setView("sections")}
              className="w-full py-3.5 rounded-xl border border-amber-500/25 text-amber-400 font-semibold text-sm"
            >
              Back to Chapters
            </button>
            <button
              onClick={() => setView("courses")}
              className="w-full py-3 rounded-xl border border-gray-800 text-gray-500 text-sm"
            >
              All Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
