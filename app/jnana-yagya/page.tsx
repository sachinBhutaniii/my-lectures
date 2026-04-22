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
  selectedAnswer: string | null;
  isCorrect: boolean;
  hintUsed: boolean;
  hintWasComplimentary: boolean;
  timedOut: boolean;
  pointsEarned: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LEVEL_NAMES     = ["Shravana", "Manana", "Nididhyasana", "Vairagya", "Tattva-Darshi"];
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

// ── Score appreciation ────────────────────────────────────────────────────────
interface ScoreMsg { icon: string; headline: string; body: string; color: string; }
function getScoreMessage(pct: number): ScoreMsg {
  if (pct === 100) return {
    icon: "🕉️", color: "#fbbf24",
    headline: "Uttama! — Supreme Knowledge!",
    body: "Like Śukadeva Gosvāmī, every answer was perfect. The entire paramparā is smiling upon you today.",
  };
  if (pct >= 90) return {
    icon: "🌟", color: "#fbbf24",
    headline: "Brilliant, Tattva-Darshi!",
    body: "Your knowledge shines like the noonday sun. Śrī Kṛṣṇa is deeply pleased with your sincere study.",
  };
  if (pct >= 75) return {
    icon: "🏆", color: "#fbbf24",
    headline: "Outstanding, Jijñāsu!",
    body: "You reflect the wisdom of the sages. Press deeper — the higher levels await your conquest.",
  };
  if (pct >= 60) return {
    icon: "🔥", color: "#f97316",
    headline: "Well done, Sādhaka!",
    body: "You have crossed the threshold. Each correct answer is a flower offered at the Lord's lotus feet.",
  };
  if (pct >= 50) return {
    icon: "✨", color: "#f97316",
    headline: "You passed — keep going!",
    body: "Strength grows at the edge of effort. Re-attempt the missed questions to truly master this level.",
  };
  if (pct >= 35) return {
    icon: "💪", color: "#ef4444",
    headline: "So close — don't give up!",
    body: "Arjuna himself hesitated before the battle. Re-attempt those questions and you shall cross this threshold.",
  };
  return {
    icon: "🙏", color: "#ef4444",
    headline: "The path begins with humility.",
    body: "The Vedas say — wisdom dawns only after hearing many times. Study, reflect, and come back stronger.",
  };
}

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
function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
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

// ── Opening Splash ────────────────────────────────────────────────────────────
function JnanaYagyaSplash({ onDismiss }: { onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 600);
  }, [onDismiss]);

  useEffect(() => {
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [dismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden cursor-pointer select-none"
      style={{
        background: "radial-gradient(ellipse at 50% 55%, #3d1a00 0%, #1a0900 45%, #000 100%)",
        animation: exiting ? "jy-exit 0.6s ease forwards" : "jy-bg-in 0.8s ease forwards",
      }}
      onClick={dismiss}
    >
      <style>{`
        @keyframes jy-bg-in   { from { opacity:0 } to { opacity:1 } }
        @keyframes jy-exit    { from { opacity:1 } to { opacity:0 } }
        @keyframes jy-ring    { 0% { transform:scale(1);   opacity:.5 } 100% { transform:scale(2.8); opacity:0 } }
        @keyframes jy-om-in   { 0% { opacity:0; transform:scale(.4) } 60% { transform:scale(1.08) } 100% { opacity:1; transform:scale(1) } }
        @keyframes jy-glow    { 0%,100% { filter:drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 28px #f97316) }
                                 50%    { filter:drop-shadow(0 0 22px #fbbf24) drop-shadow(0 0 55px #f97316) } }
        @keyframes jy-spark   { 0%   { opacity:0; transform:translateY(0)     scale(1)   }
                                 18%  { opacity:1 }
                                 100% { opacity:0; transform:translateY(-160px) scale(.3) } }
        @keyframes jy-up      { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:translateY(0) } }
        @keyframes jy-fadein  { from { opacity:0 } to { opacity:1 } }
        @keyframes jy-shimmer { 0%   { background-position:-200% 0 } 100% { background-position:200% 0 } }
        @keyframes jy-blink   { 0%,100% { opacity:.3 } 50% { opacity:.75 } }
      `}</style>

      {/* Expanding rings */}
      {[0, 1].map(i => (
        <div key={i} style={{
          position: "absolute",
          width: 180, height: 180,
          border: "1px solid rgba(251,191,36,0.35)",
          borderRadius: "50%",
          animation: `jy-ring 2.4s ease-out infinite`,
          animationDelay: `${i * 1.2}s`,
        }} />
      ))}

      {/* Sparks */}
      {[
        { left: "44%", delay: 0.4,  size: 5, color: "#fbbf24" },
        { left: "49%", delay: 0.9,  size: 4, color: "#f97316" },
        { left: "53%", delay: 0.2,  size: 6, color: "#fbbf24" },
        { left: "47%", delay: 1.1,  size: 3, color: "#fde68a" },
        { left: "51%", delay: 1.5,  size: 4, color: "#f97316" },
        { left: "42%", delay: 0.7,  size: 5, color: "#fbbf24" },
        { left: "55%", delay: 1.8,  size: 3, color: "#fde68a" },
      ].map(({ left, delay, size, color }, i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: "52%",
          left,
          width: size, height: size,
          borderRadius: "50%",
          background: color,
          animation: `jy-spark ${1.6 + (i % 3) * 0.5}s ease-out infinite`,
          animationDelay: `${delay}s`,
          opacity: 0,
        }} />
      ))}

      {/* Om symbol */}
      <div style={{
        fontSize: 88,
        lineHeight: 1,
        animation: "jy-om-in 1s cubic-bezier(.34,1.56,.64,1) forwards 0.4s, jy-glow 2.2s ease-in-out infinite 1.4s",
        opacity: 0,
      }}>🕉</div>

      {/* Title */}
      <div style={{
        marginTop: 28,
        textAlign: "center",
        animation: "jy-up 0.8s ease forwards",
        animationDelay: "1.1s",
        opacity: 0,
      }}>
        <h1 style={{
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: "0.04em",
          background: "linear-gradient(90deg, #b45309, #fef3c7 40%, #fbbf24 60%, #b45309)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "jy-shimmer 3s linear infinite",
          animationDelay: "2s",
        }}>
          Jñāna Yajña
        </h1>
        <p style={{
          color: "#92400e",
          fontSize: 11,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          marginTop: 8,
        }}>
          Sacrifice of Knowledge
        </p>
      </div>

      {/* Shloka */}
      <div style={{
        marginTop: 44,
        textAlign: "center",
        padding: "0 48px",
        animation: "jy-fadein 0.8s ease forwards",
        animationDelay: "1.9s",
        opacity: 0,
      }}>
        <p style={{ color: "#7c2d12", fontSize: 13, fontStyle: "italic", lineHeight: 1.7 }}>
          &#8220;jñāna-yajñena cāpy anye<br />yajanto mām upāsate&#8221;
        </p>
        <p style={{ color: "#78350f", fontSize: 11, marginTop: 6 }}>— Bhagavad Gītā 9.15</p>
      </div>

      {/* Tap to begin */}
      <p style={{
        position: "absolute",
        bottom: 56,
        color: "rgba(251,191,36,0.55)",
        fontSize: 12,
        letterSpacing: "0.12em",
        animation: "jy-fadein 0.6s ease forwards, jy-blink 1.8s ease-in-out infinite",
        animationDelay: "2.8s, 3.4s",
        opacity: 0,
      }}>
        touch anywhere to begin
      </p>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function PageHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-amber-900/30 sticky top-0 bg-[#1a1208] z-10">
      <button onClick={onBack} className="text-gray-400 hover:text-white p-1"><ChevronLeft /></button>
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
function TimerCircle({ timeLeft }: { timeLeft: number }) {
  const color = timeLeft <= 10 ? "#ef4444" : timeLeft <= 20 ? "#f97316" : "#22c55e";
  const r = 15.9;
  const circ = 2 * Math.PI * r;
  const dash = (timeLeft / TIMER_SECS) * circ;
  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#1c1300" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s linear, stroke 0.3s" }} />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{timeLeft}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JnanaYagyaPage() {
  const router   = useRouter();
  const { user, authLoading, isParentAdmin } = useAuth();
  const progress = useJnanaProgress();

  const [view, setView] = useState<View>("courses");

  // Access guard — redirect non-parent-admins back to home
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    if (!isParentAdmin) router.replace("/");
  }, [user, authLoading, isParentAdmin, router]);

  // Splash
  const [showSplash,  setShowSplash]  = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionStorage.getItem("bdd_jy_splash")) {
      setShowSplash(true);
      sessionStorage.setItem("bdd_jy_splash", "1");
    }
  }, []);

  // Course list
  const [courses,   setCourses]   = useState<Course[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected course + sections
  const [selectedCourse,   setSelectedCourse]   = useState<Course | null>(null);
  const [sections,         setSections]         = useState<CourseSection[]>([]);
  const [sectionsLoading,  setSectionsLoading]  = useState(false);

  // Selected section + levels
  const [selectedSection,  setSelectedSection]  = useState<CourseSection | null>(null);
  const [computedLevels,   setComputedLevels]   = useState<QuestionDto[][]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError,   setQuestionsError]   = useState<string | null>(null);

  // Quiz navigation
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0);

  // Active quiz state
  const [quizQuestions,           setQuizQuestions]           = useState<QuestionDto[]>([]);
  const [qIdx,                    setQIdx]                    = useState(0);
  const [timeLeft,                setTimeLeft]                = useState(TIMER_SECS);
  const [selectedOpt,             setSelectedOpt]             = useState<string | null>(null);
  const [answered,                setAnswered]                = useState(false);
  const [hintsUsedThisQuiz,       setHintsUsedThisQuiz]       = useState(0);
  const [hintUsedForCurrentQ,     setHintUsedForCurrentQ]     = useState(false);
  const [hintComplimentaryForCurrentQ, setHintComplimentaryForCurrentQ] = useState(false);
  const [showHintConfirm,         setShowHintConfirm]         = useState(false);
  const [hintRevealed,            setHintRevealed]            = useState(false);
  const [attempts,                setAttempts]                = useState<QuestionAttempt[]>([]);
  const [isReattempt,             setIsReattempt]             = useState(false);
  const [comboStreak,             setComboStreak]             = useState(0); // consecutive correct

  // Results data
  const [firstAttemptScore,    setFirstAttemptScore]    = useState(0);
  const [firstAttemptMaxScore, setFirstAttemptMaxScore] = useState(0);
  const [firstAttemptAttempts, setFirstAttemptAttempts] = useState<QuestionAttempt[]>([]);
  const [reattemptAttempts,    setReattemptAttempts]    = useState<QuestionAttempt[]>([]);
  const [prevLevelResult,      setPrevLevelResult]      = useState<LevelResult | null>(null); // before current attempt

  const giftIdx = useRef(0);

  // Stale-closure-safe ref
  const qRef = useRef({
    qIdx: 0, quizQuestions: [] as QuestionDto[], answered: false,
    attempts: [] as QuestionAttempt[], hintsUsedThisQuiz: 0,
    hintUsedForCurrentQ: false, hintComplimentaryForCurrentQ: false,
    isReattempt: false, selectedSection: null as CourseSection | null,
    selectedLevelIdx: 0, firstAttemptScore: 0, firstAttemptMaxScore: 0,
    comboStreak: 0,
  });
  qRef.current = {
    qIdx, quizQuestions, answered, attempts, hintsUsedThisQuiz,
    hintUsedForCurrentQ, hintComplimentaryForCurrentQ,
    isReattempt, selectedSection, selectedLevelIdx,
    firstAttemptScore, firstAttemptMaxScore, comboStreak,
  };

  // Load courses
  useEffect(() => {
    getCourses().then(setCourses).catch(() => setLoadError("Failed to load courses")).finally(() => setLoading(false));
  }, []);

  // Timer countdown
  useEffect(() => {
    if (view !== "quiz-active" && view !== "quiz-reattempt") return;
    if (answered || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, view, answered]);

  // Auto-submit on timeout
  useEffect(() => {
    if (timeLeft !== 0) return;
    if (view !== "quiz-active" && view !== "quiz-reattempt") return;
    const ref = qRef.current;
    if (ref.answered) return;
    const q = ref.quizQuestions[ref.qIdx];
    if (!q) return;
    setAnswered(true);
    setComboStreak(0); // timeout breaks streak
    setAttempts(prev => [...prev, {
      questionId: q.id!, selectedAnswer: null, isCorrect: false,
      hintUsed: ref.hintUsedForCurrentQ, hintWasComplimentary: ref.hintComplimentaryForCurrentQ,
      timedOut: true, pointsEarned: 0,
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openCourse = useCallback(async (course: Course) => {
    setSelectedCourse(course);
    setSectionsLoading(true);
    setView("sections");
    setSections([]);
    try {
      const detail = await getCourse(course.id);
      setSections(detail.sections);
      progress.saveSectionIds(course.id, detail.sections.map(s => s.id));
    } catch { setSections([]); }
    finally { setSectionsLoading(false); }
  }, [progress]);

  const openSection = useCallback(async (section: CourseSection) => {
    setSelectedSection(section);
    setComputedLevels([]);
    setQuestionsError(null);
    setQuestionsLoading(true);
    setView("quiz-levels");
    try {
      const questions = await getSectionQuestions(section.id);
      const levels    = computeQuizLevels(questions);
      setComputedLevels(levels);
      progress.saveLevelCount(section.id, levels.length);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setQuestionsError(
        status === 403
          ? "Quiz access requires login. Please sign in to continue."
          : "Failed to load questions. Please try again."
      );
    }
    finally { setQuestionsLoading(false); }
  }, [progress]);

  const openLevel = useCallback((levelIdx: number) => {
    setSelectedLevelIdx(levelIdx);
    setView("quiz-rules");
  }, []);

  const startQuiz = useCallback(() => {
    const qs = computedLevels[selectedLevelIdx] ?? [];
    setQuizQuestions(qs);
    setQIdx(0); setTimeLeft(TIMER_SECS); setSelectedOpt(null); setAnswered(false);
    setHintsUsedThisQuiz(0); setHintUsedForCurrentQ(false); setHintComplimentaryForCurrentQ(false);
    setShowHintConfirm(false); setHintRevealed(false); setAttempts([]);
    setIsReattempt(false); setComboStreak(0);
    setView("quiz-active");
  }, [computedLevels, selectedLevelIdx]);

  const handleSelectAnswer = useCallback((key: string) => {
    const ref = qRef.current;
    if (ref.answered) return;
    const q = ref.quizQuestions[ref.qIdx];
    if (!q) return;
    const correct = isAnswerCorrect(key, q.correctAnswer ?? "");
    const points  = calcPoints(correct, ref.hintUsedForCurrentQ, ref.hintComplimentaryForCurrentQ);
    setSelectedOpt(key);
    setAnswered(true);
    setComboStreak(correct ? ref.comboStreak + 1 : 0);
    setAttempts(prev => [...prev, {
      questionId: q.id!, selectedAnswer: key, isCorrect: correct,
      hintUsed: ref.hintUsedForCurrentQ, hintWasComplimentary: ref.hintComplimentaryForCurrentQ,
      timedOut: false, pointsEarned: points,
    }]);
  }, []);

  const handleUseHint = useCallback(() => {
    setShowHintConfirm(false);
    const isComplimentary = qRef.current.hintsUsedThisQuiz === 0;
    setHintsUsedThisQuiz(p => p + 1);
    setHintUsedForCurrentQ(true);
    setHintComplimentaryForCurrentQ(isComplimentary);
    setHintRevealed(true);
  }, []);

  const finalizeQuiz = useCallback((finalAttempts: QuestionAttempt[]) => {
    const ref   = qRef.current;
    const score = finalAttempts.reduce((s, a) => s + a.pointsEarned, 0);
    if (ref.isReattempt) {
      const combined    = ref.firstAttemptScore + score;
      const combinedMax = ref.firstAttemptMaxScore;
      const passed      = combined >= combinedMax * 0.5;
      if (ref.selectedSection) {
        progress.saveLevelResult(ref.selectedSection.id, ref.selectedLevelIdx, {
          score: combined, maxScore: combinedMax, passed, completed: true,
          attemptedAt: new Date().toISOString(),
        });
      }
      setReattemptAttempts(finalAttempts);
      setAttempts(finalAttempts);
      setView("quiz-reattempt-results");
    } else {
      const maxScore = finalAttempts.length * 2;
      const passed   = score >= maxScore * 0.5;
      // capture previous result for improvement tracking
      const prev = ref.selectedSection ? progress.getLevelResult(ref.selectedSection.id, ref.selectedLevelIdx) : null;
      setPrevLevelResult(prev);
      if (ref.selectedSection) {
        progress.saveLevelResult(ref.selectedSection.id, ref.selectedLevelIdx, {
          score, maxScore, passed, completed: true, attemptedAt: new Date().toISOString(),
        });
      }
      setFirstAttemptScore(score);
      setFirstAttemptMaxScore(maxScore);
      setFirstAttemptAttempts(finalAttempts);
      setAttempts(finalAttempts);
      setView("quiz-results");
    }
  }, [progress]);

  const handleNext = useCallback(() => {
    const ref     = qRef.current;
    const nextIdx = ref.qIdx + 1;
    if (nextIdx >= ref.quizQuestions.length) {
      finalizeQuiz(ref.attempts);
    } else {
      setQIdx(nextIdx); setSelectedOpt(null); setAnswered(false);
      setTimeLeft(TIMER_SECS); setHintUsedForCurrentQ(false);
      setHintComplimentaryForCurrentQ(false); setHintRevealed(false);
    }
  }, [finalizeQuiz]);

  const startReattempt = useCallback(() => {
    const wrongQIds = new Set(firstAttemptAttempts.filter(a => !a.isCorrect).map(a => a.questionId));
    const wrongQs   = computedLevels[selectedLevelIdx]?.filter(q => wrongQIds.has(q.id!)) ?? [];
    setQuizQuestions(wrongQs);
    setQIdx(0); setTimeLeft(TIMER_SECS); setSelectedOpt(null); setAnswered(false);
    setHintsUsedThisQuiz(0); setHintUsedForCurrentQ(false); setHintComplimentaryForCurrentQ(false);
    setShowHintConfirm(false); setHintRevealed(false); setAttempts([]);
    setIsReattempt(true); setComboStreak(0);
    setView("quiz-reattempt");
  }, [firstAttemptAttempts, computedLevels, selectedLevelIdx]);

  const goToNextLevel = useCallback(() => {
    setSelectedLevelIdx(selectedLevelIdx + 1);
    setView("quiz-rules");
  }, [selectedLevelIdx]);

  const checkAndShowCertificate = useCallback(() => {
    if (!selectedCourse) return;
    if (progress.isCourseCompleted(selectedCourse.id)) {
      giftIdx.current = Math.floor(Math.random() * GURUDEV_MESSAGES.length);
      setView("course-complete");
    } else {
      setView("sections");
    }
  }, [selectedCourse, progress]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: COURSES
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "courses") {
    return (
      <div className="min-h-screen bg-[#1a1208] w-full max-w-4xl xl:max-w-6xl mx-auto pb-24">
        {showSplash && <JnanaYagyaSplash onDismiss={() => setShowSplash(false)} />}

        <style>{`
          @keyframes jy-card-in { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        `}</style>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-5 border-b border-amber-900/30">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white p-1"><ChevronLeft /></button>
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
            &#8220;jñāna-yajñena cāpy anye yajanto mām upāsate&#8221; — BG 9.15
          </p>
          <p className="text-gray-400 text-xs mt-2 leading-relaxed">
            Complete quizzes, earn scores, unlock levels, and receive a completion certificate from Srila Gurudev.
          </p>
        </div>

        <div className="px-4">
          {loading  && <Spinner />}
          {loadError && <p className="text-red-400 text-sm text-center pt-12">{loadError}</p>}
          {!loading && !loadError && courses.length === 0 && (
            <div className="text-center pt-16">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4"><BookIcon /></div>
              <p className="text-gray-400 text-sm">No courses available yet.</p>
            </div>
          )}
          {!loading && courses.length > 0 && (
            <div className="flex flex-col gap-4">
              {courses.map((course, idx) => {
                const pct  = progress.getCourseProgressPercent(course.id);
                const done = progress.isCourseCompleted(course.id);
                return (
                  <button key={course.id} onClick={() => openCourse(course)}
                    style={{ animation: `jy-card-in 0.5s ease forwards`, animationDelay: `${idx * 0.08}s`, opacity: 0 }}
                    className="w-full text-left rounded-2xl border border-amber-500/15 bg-gradient-to-br from-[#1c1300] to-[#110d00] overflow-hidden active:scale-[0.98] transition-transform"
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
                        <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">{course.description}</p>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-gray-500">Progress</span>
                          <span className="text-[10px] font-bold text-amber-400">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-amber-900/30 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {done && (
                        <div className="mt-3 flex items-center gap-2 text-amber-300 text-xs font-medium">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.24a1 1 0 000 1.96l1.192.24a1 1 0 01.785.785l.24 1.192a1 1 0 001.96 0l.24-1.192a1 1 0 01.785-.785l1.192-.24a1 1 0 000-1.96l-1.192-.24a1 1 0 01-.785-.785l-.24-1.192z" />
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

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "sections" && selectedCourse) {
    const courseComplete = progress.isCourseCompleted(selectedCourse.id);
    const coursePct      = progress.getCourseProgressPercent(selectedCourse.id);
    // count sections that still have at least one level unpassed
    const sectionsLeft = sections.filter(s => {
      const n = progress.getLevelCount(s.id);
      return !progress.getLevelResult(s.id, n - 1)?.passed;
    }).length;

    return (
      <div className="min-h-screen bg-[#1a1208] w-full max-w-4xl xl:max-w-6xl mx-auto pb-24">
        <PageHeader title={selectedCourse.title} subtitle="Select a chapter" onBack={() => setView("courses")} />

        {!sectionsLoading && sections.length > 0 && (
          <div className="mx-4 mt-5 mb-1 rounded-xl border border-amber-500/15 bg-[#1c1300]/60 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Overall Progress</span>
              <span className="text-xs font-bold text-amber-400">{coursePct}%</span>
            </div>
            <div className="h-2 rounded-full bg-amber-900/30 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700" style={{ width: `${coursePct}%` }} />
            </div>
            {/* Motivational nudge */}
            {!courseComplete && sectionsLeft > 0 && coursePct > 0 && (
              <p className="text-amber-700 text-[10px] mt-2 italic">
                {sectionsLeft === 1
                  ? "🏁 Just 1 chapter away from your certificate — finish strong!"
                  : `🔥 ${sectionsLeft} chapters left — keep the momentum going!`
                }
              </p>
            )}
            {courseComplete && (
              <button
                onClick={() => { giftIdx.current = Math.floor(Math.random() * GURUDEV_MESSAGES.length); setView("course-complete"); }}
                className="mt-3 w-full py-2 rounded-lg bg-amber-500 text-black text-xs font-bold flex items-center justify-center gap-2"
              >
                ✨ View Certificate &amp; Gift from Srila Gurudev
              </button>
            )}
          </div>
        )}

        <div className="px-4 pt-4">
          {sectionsLoading && <Spinner />}
          {!sectionsLoading && sections.length === 0 && <p className="text-gray-500 text-sm text-center pt-12">No chapters yet.</p>}
          {!sectionsLoading && sections.length > 0 && (
            <div className="flex flex-col gap-3">
              {sections.map((section, idx) => {
                const numLevels   = progress.getLevelCount(section.id);
                const levelResults = Array.from({ length: numLevels }, (_, i) => progress.getLevelResult(section.id, i));
                const passedCount  = levelResults.filter(r => r?.passed).length;
                const allPassed    = passedCount === numLevels;
                const lastAttempt  = levelResults.filter(Boolean).sort((a, b) =>
                  new Date(b!.attemptedAt).getTime() - new Date(a!.attemptedAt).getTime()
                )[0];

                return (
                  <button key={section.id} onClick={() => openSection(section)}
                    className="w-full text-left flex items-center gap-4 px-4 py-4 rounded-2xl border border-amber-500/10 bg-[#1c1300]/60 hover:border-amber-500/30 active:scale-[0.98] transition-all"
                  >
                    <span className="w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: allPassed ? "rgba(251,191,36,0.15)" : "rgba(251,191,36,0.06)",
                        borderColor: allPassed ? "rgba(251,191,36,0.4)" : "rgba(251,191,36,0.15)",
                        color: allPassed ? "#fbbf24" : "#a16207",
                      }}>
                      {allPassed ? "✓" : idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-amber-100 text-sm font-semibold leading-snug">{section.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex gap-1">
                          {Array.from({ length: numLevels }).map((_, li) => {
                            const r = levelResults[li];
                            return <span key={li} className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                background: r?.passed ? "#fbbf24" : r?.completed ? "#f97316" : "rgba(251,191,36,0.15)",
                                border: r?.passed ? "none" : "1px solid rgba(251,191,36,0.2)",
                              }} />;
                          })}
                        </div>
                        <span className="text-gray-500 text-[10px]">{passedCount}/{numLevels} levels</span>
                        {lastAttempt && (
                          <span className="text-gray-700 text-[10px]">· {daysAgo(lastAttempt.attemptedAt)}</span>
                        )}
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

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: QUIZ LEVELS
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "quiz-levels" && selectedSection) {
    return (
      <div className="min-h-screen bg-[#1a1208] w-full max-w-4xl xl:max-w-6xl mx-auto pb-24">
        <PageHeader title={selectedSection.title} subtitle="Choose a level" onBack={() => setView("sections")} />
        <div className="px-4 pt-5">
          {questionsLoading && <Spinner />}
          {questionsError && <p className="text-red-400 text-sm text-center pt-12 px-4">{questionsError}</p>}
          {!questionsLoading && !questionsError && computedLevels.length === 0 && (
            <p className="text-gray-500 text-sm text-center pt-12">No questions available yet.</p>
          )}
          {!questionsLoading && !questionsError && computedLevels.length > 0 && (
            <div className="flex flex-col gap-3">
              {computedLevels.map((levelQs, li) => {
                const total    = computedLevels.length;
                const name     = getLevelName(li, total);
                const subtitle = getLevelSubtitle(li, total);
                const result   = progress.getLevelResult(selectedSection.id, li);
                const prevPass = li === 0 ? true : !!progress.getLevelResult(selectedSection.id, li - 1)?.passed;
                const locked   = !prevPass;
                const numQs    = levelQs.length;
                const totalTime = numQs * TIMER_SECS;
                const mins = Math.floor(totalTime / 60), secs = totalTime % 60;

                return (
                  <button key={li} onClick={() => !locked && openLevel(li)} disabled={locked}
                    className={`w-full text-left rounded-2xl border px-5 py-4 transition-all active:scale-[0.98] ${
                      locked ? "border-gray-800 bg-[#0e0e0e] opacity-50 cursor-not-allowed"
                      : result?.passed ? "border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-[#1c1300]"
                      : "border-amber-500/15 bg-[#1c1300]/60 hover:border-amber-500/30"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        result?.passed ? "bg-amber-500/20 border border-amber-500/40"
                        : locked ? "bg-gray-800 border border-gray-700"
                        : "bg-amber-500/10 border border-amber-500/20"}`}>
                        {locked ? <LockIcon /> : result?.passed ? <span className="text-amber-400 font-bold text-sm">✓</span>
                          : <span className="text-amber-500 font-bold text-sm">{li + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-bold text-sm ${locked ? "text-gray-600" : "text-amber-200"}`}>{name}</p>
                          {result?.passed && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">PASSED</span>}
                          {result?.completed && !result.passed && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">FAILED</span>}
                        </div>
                        <p className={`text-xs mt-0.5 ${locked ? "text-gray-700" : "text-gray-500"}`}>{subtitle}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
                          <span>{numQs} questions</span><span>·</span>
                          <span>{mins}m{secs > 0 ? ` ${secs}s` : ""}</span><span>·</span>
                          <span>{numQs * 2} pts max</span>
                          {result && <span>· {daysAgo(result.attemptedAt)}</span>}
                        </div>
                        {result && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-gray-600">Best score</span>
                              <span className={`text-[10px] font-bold ${result.passed ? "text-amber-400" : "text-red-400"}`}>
                                {result.score}/{result.maxScore} ({Math.round((result.score / result.maxScore) * 100)}%)
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-amber-900/30 overflow-hidden">
                              <div className={`h-full rounded-full ${result.passed ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${Math.round((result.score / result.maxScore) * 100)}%` }} />
                            </div>
                          </div>
                        )}
                        {locked && <p className="text-[10px] text-gray-700 mt-1.5">Pass {getLevelName(li - 1, total)} to unlock</p>}
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

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: QUIZ RULES
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "quiz-rules" && selectedSection) {
    const levelQs   = computedLevels[selectedLevelIdx] ?? [];
    const levelName = getLevelName(selectedLevelIdx, computedLevels.length);
    const totalTime = levelQs.length * TIMER_SECS;
    const mins = Math.floor(totalTime / 60), secs = totalTime % 60;

    return (
      <div className="min-h-screen bg-[#1a1208] w-full max-w-4xl xl:max-w-6xl mx-auto pb-24">
        <PageHeader title={levelName} subtitle={selectedSection.title} onBack={() => setView("quiz-levels")} />
        <div className="px-5 pt-6 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Questions", value: levelQs.length.toString() },
              { label: "Time",      value: `${mins}m${secs > 0 ? ` ${secs}s` : ""}` },
              { label: "Max Score", value: `${levelQs.length * 2} pts` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-amber-500/15 bg-[#1c1300]/60 px-3 py-3 text-center">
                <p className="text-amber-200 font-bold text-base">{value}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-amber-500/15 bg-[#1c1300]/60 px-5 py-5">
            <p className="text-amber-300 font-bold text-xs tracking-wider uppercase mb-4">Rules of the Battlefield</p>
            <div className="flex flex-col gap-3">
              {[
                "Each question carries 2 points.",
                "2 points are awarded only when the right answer is marked on the first attempt without using a hint.",
                "If a wrong answer is marked, the score for that question is zero.",
                "If a hint is used, only 1 point is awarded on a correct answer.",
                "1 Hint per quiz is complimentary — the first hint does NOT reduce your score.",
              ].map((rule, n) => (
                <div key={n} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 text-[10px] font-bold flex-shrink-0 mt-0.5">{n + 1}</span>
                  <p className="text-gray-300 text-xs leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#f97316" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <p className="text-orange-300 text-xs leading-relaxed">Score at least <span className="font-bold">50%</span> to unlock the next level.</p>
          </div>
          <button onClick={startQuiz}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-base tracking-wide active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20">
            ⚔️&nbsp; Enter the Battlefield
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: QUIZ ACTIVE (+ REATTEMPT)
  // ═══════════════════════════════════════════════════════════════════════════
  if ((view === "quiz-active" || view === "quiz-reattempt") && selectedSection) {
    const currentQ = quizQuestions[qIdx];
    if (!currentQ) return null;
    const total   = quizQuestions.length;
    const options = parseOptions(currentQ.optionsJson);
    const isTF    = currentQ.type === "TRUE_FALSE";
    const displayOptions = isTF && !options.length
      ? [{ key: "True", text: "True" }, { key: "False", text: "False" }]
      : options;

    return (
      <div className="min-h-screen bg-[#1a1208] w-full max-w-4xl xl:max-w-6xl mx-auto pb-6 flex flex-col">
        {/* Quiz header */}
        <div className="px-4 pt-10 pb-3 border-b border-amber-900/20">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setView(view === "quiz-reattempt" ? "quiz-results" : "quiz-rules")}
              className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-1">
              <ChevronLeft /> Quit
            </button>
            <div className="flex items-center gap-2">
              {comboStreak >= 3 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400">
                  🔥 {comboStreak} streak
                </span>
              )}
              <span className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">
                {isReattempt ? "Re-attempt" : getLevelName(selectedLevelIdx, computedLevels.length)}
              </span>
            </div>
            <span className="text-xs text-gray-500">{qIdx + 1} / {total}</span>
          </div>
          <div className="flex gap-1 justify-center mt-1">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className="h-1 rounded-full transition-all"
                style={{
                  width: i === qIdx ? "20px" : "6px",
                  background: i < qIdx ? "#fbbf24" : i === qIdx ? "#f97316" : "rgba(251,191,36,0.15)",
                }} />
            ))}
          </div>
        </div>

        <div className="flex-1 px-5 pt-5">
          <div className="flex items-start gap-4 mb-5">
            <TimerCircle timeLeft={timeLeft} />
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 text-amber-600">{currentQ.difficulty ?? "MEDIUM"}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-700 text-gray-500">
                  {currentQ.type === "TRUE_FALSE" ? "True / False" : currentQ.type === "ASSERTION_REASONING" ? "Assertion & Reason" : "MCQ"}
                </span>
              </div>
            </div>
          </div>

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

          <p className="text-white text-base leading-relaxed font-medium mb-5">{currentQ.questionText}</p>

          {hintRevealed && currentQ.source && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#fbbf24" className="w-4 h-4 flex-shrink-0 mt-0.5">
                <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.544a.75.75 0 00.75.75h2.5a.75.75 0 00.75-.75v-.544c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.75 17.25a.75.75 0 001.5 0v-.5a.75.75 0 00-1.5 0v.5z" />
              </svg>
              <div>
                <p className="text-amber-400 text-[10px] font-bold mb-0.5">HINT — Source</p>
                <p className="text-amber-200 text-xs leading-relaxed">{currentQ.source}</p>
                {!hintComplimentaryForCurrentQ && <p className="text-amber-600 text-[10px] mt-1">Non-complimentary hint — max 1 pt for this question.</p>}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex flex-col gap-2.5 mb-6">
            {displayOptions.map((opt) => {
              const isSelected = selectedOpt === opt.key;
              let style = "border-amber-500/10 bg-[#1c1300]/40 text-gray-300";
              if (answered && isSelected) {
                style = "border-amber-500/50 bg-amber-500/15 text-amber-200";
              } else if (answered && !isSelected) {
                style = "border-gray-800/50 bg-[#111]/40 text-gray-600 opacity-50";
              }
              return (
                <button key={opt.key} onClick={() => handleSelectAnswer(opt.key)} disabled={answered}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all ${style} ${!answered ? "hover:border-amber-500/30 active:scale-[0.98]" : ""}`}>
                  <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                    answered && isSelected
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                      : "bg-amber-500/5 border-amber-500/20 text-amber-600"}`}>{opt.key}</span>
                  <span className="text-sm leading-relaxed">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {answered && !selectedOpt && (
            <div className="mb-4 text-center rounded-xl border border-orange-500/20 bg-orange-500/8 py-3">
              <p className="text-orange-400 text-sm font-semibold">⏱ Time&apos;s up!</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 flex gap-3">
          {!answered && (
            <button onClick={() => !hintRevealed && setShowHintConfirm(true)}
              disabled={hintRevealed || !currentQ.source}
              className={`flex items-center gap-1.5 px-4 py-3 rounded-xl border text-xs font-semibold transition-colors ${
                hintRevealed || !currentQ.source
                  ? "border-gray-800 bg-[#111] text-gray-700 cursor-not-allowed"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.544a.75.75 0 00.75.75h2.5a.75.75 0 00.75-.75v-.544c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.75 17.25a.75.75 0 001.5 0v-.5a.75.75 0 00-1.5 0v.5z" />
              </svg>
              Hint
              {hintsUsedThisQuiz === 0 && !hintRevealed && currentQ.source && (
                <span className="px-1 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300">FREE</span>
              )}
            </button>
          )}
          {answered && (
            <button onClick={handleNext}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm active:scale-[0.98] transition-all">
              {qIdx + 1 >= total ? "Finish Quiz →" : "Next →"}
            </button>
          )}
        </div>

        {showHintConfirm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm px-4 pb-8">
            <div className="w-full max-w-md rounded-2xl border border-amber-500/25 bg-[#1a1208] p-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#fbbf24" className="w-5 h-5">
                  <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.544a.75.75 0 00.75.75h2.5a.75.75 0 00.75-.75v-.544c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-base text-center mb-1">Use a Hint?</h3>
              {hintsUsedThisQuiz === 0
                ? <p className="text-gray-400 text-xs text-center mb-4 leading-relaxed">This is your <span className="text-amber-400 font-semibold">complimentary hint</span> — it shows the question&apos;s source and will <span className="text-amber-400 font-semibold">not</span> reduce your score.</p>
                : <p className="text-gray-400 text-xs text-center mb-4 leading-relaxed">You have already used your complimentary hint. This will show the source but <span className="text-red-400 font-semibold">reduces your max score to 1 pt</span> for this question.</p>
              }
              <div className="flex gap-3">
                <button onClick={() => setShowHintConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm">Cancel</button>
                <button onClick={handleUseHint} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-bold">Show Hint</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: QUIZ RESULTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "quiz-results" && selectedSection) {
    const maxScore   = firstAttemptMaxScore;
    const score      = firstAttemptScore;
    const pct        = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed     = score >= maxScore * 0.5;
    const wrongCount = firstAttemptAttempts.filter(a => !a.isCorrect).length;
    const isLastLevel = selectedLevelIdx === computedLevels.length - 1;
    const msg        = getScoreMessage(pct);
    // Improvement over previous attempt
    const improvement = prevLevelResult ? score - prevLevelResult.score : null;
    const ptsMissing  = !passed ? Math.ceil(maxScore * 0.5) - score : 0;
    const nextLvl     = !isLastLevel ? computedLevels[selectedLevelIdx + 1] : null;

    return (
      <div className="min-h-screen bg-[#1a1208] w-full max-w-4xl xl:max-w-6xl mx-auto pb-24">
        <div className="px-4 pt-12 pb-4 border-b border-amber-900/30 max-w-3xl mx-auto w-full">
          <p className="text-amber-700 text-[10px] tracking-widest uppercase text-center mb-1">
            {getLevelName(selectedLevelIdx, computedLevels.length)} — Results
          </p>
          <h1 className="text-white font-bold text-lg text-center">{selectedSection.title}</h1>
        </div>

        <div className="px-5 pt-5 flex flex-col gap-4 max-w-3xl mx-auto w-full">
          {/* Score card */}
          <div className={`rounded-2xl border px-6 py-5 text-center ${passed ? "border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-[#1c1300]" : "border-red-500/20 bg-red-900/10"}`}>
            <div className="text-4xl font-black mb-1" style={{ color: passed ? "#fbbf24" : "#ef4444" }}>
              {score}<span className="text-xl text-gray-500">/{maxScore}</span>
            </div>
            <p className="text-gray-400 text-xs mb-3">{pct}% · {passed ? "Passed ✓" : "Not passed"}</p>
            <div className="h-2 rounded-full bg-black/30 overflow-hidden mb-3">
              <div className={`h-full rounded-full ${passed ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
            </div>
            {/* Improvement */}
            {improvement !== null && (
              <p className={`text-xs font-semibold mb-2 ${improvement > 0 ? "text-green-400" : improvement < 0 ? "text-red-400" : "text-gray-500"}`}>
                {improvement > 0 ? `📈 +${improvement} pts vs last attempt` : improvement < 0 ? `📉 ${improvement} pts vs last attempt` : "↔ Same as last attempt"}
              </p>
            )}
            {!passed && ptsMissing > 0 && (
              <p className="text-orange-400 text-xs">You were just <span className="font-bold">{ptsMissing} pt{ptsMissing > 1 ? "s" : ""}</span> short of passing.</p>
            )}
          </div>

          {/* Appreciation message */}
          <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-900/10 to-[#1c1300] px-5 py-4">
            <p className="text-2xl mb-2 text-center">{msg.icon}</p>
            <p className="font-bold text-sm text-center mb-1.5" style={{ color: msg.color }}>{msg.headline}</p>
            <p className="text-gray-400 text-xs leading-relaxed text-center">{msg.body}</p>
          </div>

          {/* Next level teaser */}
          {passed && nextLvl && (
            <div className="rounded-xl border border-amber-500/20 bg-[#1c1300]/60 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 text-xs font-bold">{selectedLevelIdx + 2}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-amber-300 text-xs font-semibold">Next: {getLevelName(selectedLevelIdx + 1, computedLevels.length)}</p>
                <p className="text-gray-600 text-[10px]">{nextLvl.length} questions · {nextLvl.length * 2} pts max · harder challenges await</p>
              </div>
            </div>
          )}

          {/* Question review */}
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Question Review</p>
            <div className="flex flex-col gap-2">
              {firstAttemptAttempts.map((attempt, i) => {
                const q = (computedLevels[selectedLevelIdx] ?? []).find(qq => qq.id === attempt.questionId);
                return (
                  <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${attempt.isCorrect ? "border-green-500/20 bg-green-900/10" : "border-red-500/15 bg-red-900/8"}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${attempt.isCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                      {attempt.isCorrect ? "✓" : "✗"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-xs leading-relaxed line-clamp-2">{q?.questionText ?? `Question ${i + 1}`}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold ${attempt.isCorrect ? "text-green-400" : "text-red-400"}`}>{attempt.pointsEarned}/2 pts</span>
                        {attempt.hintUsed && <span className="text-[10px] text-amber-600">{attempt.hintWasComplimentary ? "hint (free)" : "hint used"}</span>}
                        {attempt.timedOut && <span className="text-[10px] text-red-600">timed out</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily nudge */}
          {passed && (
            <div className="rounded-xl border border-amber-900/30 bg-[#1c1300]/30 px-4 py-3 flex items-center gap-2.5">
              <span className="text-base">🌅</span>
              <p className="text-amber-800 text-xs leading-relaxed">
                Come back tomorrow to maintain your study momentum and keep the knowledge fresh.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            {wrongCount > 0 && (
              <button onClick={startReattempt}
                className="w-full py-3.5 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-300 font-bold text-sm">
                Re-attempt {wrongCount} wrong question{wrongCount > 1 ? "s" : ""}
              </button>
            )}
            {passed && !isLastLevel && (
              <button onClick={goToNextLevel}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm">
                Next Level: {getLevelName(selectedLevelIdx + 1, computedLevels.length)} →
              </button>
            )}
            {passed && isLastLevel && (
              <button onClick={checkAndShowCertificate}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm">
                ✨ Chapter Complete — View Certificate
              </button>
            )}
            <button onClick={() => setView("quiz-levels")}
              className="w-full py-3 rounded-xl border border-gray-800 text-gray-400 text-sm">
              Back to Levels
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: REATTEMPT RESULTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "quiz-reattempt-results" && selectedSection) {
    const levelResult   = progress.getLevelResult(selectedSection.id, selectedLevelIdx);
    const combinedScore = levelResult?.score ?? 0;
    const combinedMax   = levelResult?.maxScore ?? firstAttemptMaxScore;
    const pct           = combinedMax > 0 ? Math.round((combinedScore / combinedMax) * 100) : 0;
    const passed        = levelResult?.passed ?? false;
    const isLastLevel   = selectedLevelIdx === computedLevels.length - 1;
    const reAttemptPts  = reattemptAttempts.reduce((s, a) => s + a.pointsEarned, 0);
    const msg           = getScoreMessage(pct);
    const improvement   = prevLevelResult ? combinedScore - prevLevelResult.score : null;

    return (
      <div className="min-h-screen bg-[#1a1208] w-full max-w-4xl xl:max-w-6xl mx-auto pb-24">
        <div className="px-4 pt-12 pb-4 border-b border-amber-900/30">
          <p className="text-amber-700 text-[10px] tracking-widest uppercase text-center mb-1">Re-attempt Results</p>
          <h1 className="text-white font-bold text-lg text-center">{selectedSection.title}</h1>
        </div>
        <div className="px-5 pt-5 flex flex-col gap-4">
          <div className={`rounded-2xl border px-6 py-5 text-center ${passed ? "border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-[#1c1300]" : "border-red-500/20 bg-red-900/10"}`}>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Combined Score</p>
            <div className="text-4xl font-black mb-1" style={{ color: passed ? "#fbbf24" : "#ef4444" }}>
              {combinedScore}<span className="text-xl text-gray-500">/{combinedMax}</span>
            </div>
            <p className="text-gray-500 text-xs mb-1">First: {firstAttemptScore} pts + Re-attempt: +{reAttemptPts} pts</p>
            <p className="text-gray-400 text-xs mb-3">{pct}%</p>
            <div className="h-2 rounded-full bg-black/30 overflow-hidden mb-3">
              <div className={`h-full rounded-full ${passed ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
            </div>
            {improvement !== null && improvement > 0 && (
              <p className="text-green-400 text-xs font-semibold">📈 +{improvement} pts improvement!</p>
            )}
          </div>

          {/* Appreciation */}
          <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-900/10 to-[#1c1300] px-5 py-4">
            <p className="text-2xl mb-2 text-center">{msg.icon}</p>
            <p className="font-bold text-sm text-center mb-1.5" style={{ color: msg.color }}>{msg.headline}</p>
            <p className="text-gray-400 text-xs leading-relaxed text-center">{msg.body}</p>
          </div>

          {/* Re-attempt review */}
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Re-attempt Review</p>
            <div className="flex flex-col gap-2">
              {reattemptAttempts.map((attempt, i) => {
                const q = (computedLevels[selectedLevelIdx] ?? []).find(qq => qq.id === attempt.questionId);
                return (
                  <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${attempt.isCorrect ? "border-green-500/20 bg-green-900/10" : "border-red-500/15 bg-red-900/8"}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${attempt.isCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                      {attempt.isCorrect ? "✓" : "✗"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-xs leading-relaxed line-clamp-2">{q?.questionText ?? `Question ${i + 1}`}</p>
                      <span className={`text-[10px] font-bold mt-1 inline-block ${attempt.isCorrect ? "text-green-400" : "text-red-400"}`}>+{attempt.pointsEarned} pts earned</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {passed && !isLastLevel && (
              <button onClick={goToNextLevel}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm">
                Next Level: {getLevelName(selectedLevelIdx + 1, computedLevels.length)} →
              </button>
            )}
            {passed && isLastLevel && (
              <button onClick={checkAndShowCertificate}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black text-sm">
                ✨ Chapter Complete — View Certificate
              </button>
            )}
            <button onClick={() => setView("quiz-levels")}
              className="w-full py-3 rounded-xl border border-gray-800 text-gray-400 text-sm">
              Back to Levels
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: COURSE COMPLETE — Certificate
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "course-complete" && selectedCourse) {
    const completionDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const userName  = user?.name ?? "Dear Devotee";
    const giftMsg   = GURUDEV_MESSAGES[giftIdx.current] ?? GURUDEV_MESSAGES[0];

    return (
      <div className="min-h-screen bg-[#1a1208] w-full max-w-4xl xl:max-w-6xl mx-auto pb-24">
        <div className="px-4 pt-10 pb-4 flex items-center gap-3 border-b border-amber-900/30">
          <button onClick={() => setView("sections")} className="text-gray-400 hover:text-white p-1"><ChevronLeft /></button>
          <p className="text-amber-700 text-[10px] tracking-widest uppercase">Course Certificate</p>
        </div>
        <div className="px-5 pt-8 flex flex-col gap-6">
          {/* Certificate */}
          <div className="relative rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-[#241a00] via-[#1c1300] to-[#0e0900] overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-700 via-amber-400 to-amber-700" />
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-amber-500/40 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-500/40 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-500/40 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-amber-500/40 rounded-br-lg" />
            <div className="px-8 py-8 text-center">
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
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-700 via-amber-400 to-amber-700" />
          </div>

          {/* Gift */}
          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-900/15 to-[#1c1300] px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" className="w-5 h-5 flex-shrink-0">
                <path d="M9.375 3a1.875 1.875 0 000 3.75h1.875v4.5H3.375A1.875 1.875 0 011.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0112 2.753a3.375 3.375 0 015.432 3.997h3.943c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H13.5v-4.5h1.875a1.875 1.875 0 100-3.75H13.5v4.5h-3V3h-1.125z" />
                <path d="M11.25 12.75H3v6.75a2.25 2.25 0 002.25 2.25h6v-9zM12.75 12.75v9h6.75A2.25 2.25 0 0021.75 19.5v-6.75h-9z" />
              </svg>
              <p className="text-amber-400 font-bold text-xs uppercase tracking-wider">A Gift from Srila Gurudev</p>
            </div>
            <p className="text-amber-100 text-sm leading-relaxed italic">&ldquo;{giftMsg}&rdquo;</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button onClick={() => setView("sections")}
              className="w-full py-3.5 rounded-xl border border-amber-500/25 text-amber-400 font-semibold text-sm">
              Back to Chapters
            </button>
            <button onClick={() => setView("courses")}
              className="w-full py-3 rounded-xl border border-gray-800 text-gray-500 text-sm">
              All Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
