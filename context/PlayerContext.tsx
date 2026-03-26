"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { LectureVideo } from "@/types/videos";
import { usePlaybackHistory } from "@/hooks/usePlaybackHistory";
import { useStreak } from "@/hooks/useStreak";

const posKey = (id: number) => `bdd_pos_${id}`;

export interface PlayerContextType {
  lecture: LectureVideo | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  play: (lecture: LectureVideo) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (pct: number) => void;
  seekToSeconds: (seconds: number) => void;
  skip: (seconds: number) => void;
  setSpeed: (speed: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { addToHistory } = usePlaybackHistory();
  const { addListeningTime } = useStreak();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lectureRef = useRef<LectureVideo | null>(null);

  const [lecture, setLecture] = useState<LectureVideo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1.0);

  // Track listening time for streak (1 tick/sec while playing)
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => addListeningTime(1), 1000);
    return () => clearInterval(id);
  }, [isPlaying, addListeningTime]);

  // Save playback position every 5s while playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const lec = lectureRef.current;
      const audio = audioRef.current;
      if (lec && audio) {
        localStorage.setItem(posKey(lec.id), String(Math.floor(audio.currentTime)));
        if (audio.duration > 0) {
          const pct = Math.round((audio.currentTime / audio.duration) * 100);
          const existing = parseFloat(localStorage.getItem(`bdd_pct_${lec.id}`) ?? "0") || 0;
          if (pct > existing) localStorage.setItem(`bdd_pct_${lec.id}`, String(pct));
        }
      }
    }, 5000);
    return () => clearInterval(id);
  }, [isPlaying]);

  const play = useCallback(
    (newLecture: LectureVideo) => {
      // Same lecture already loaded — just resume
      if (audioRef.current && lectureRef.current?.id === newLecture.id) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        return;
      }

      // Tear down existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }

      lectureRef.current = newLecture;
      setLecture(newLecture);
      setCurrentTime(0);
      setDuration(0);
      addToHistory(newLecture);

      if (!newLecture.audioUrl) {
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const audio = new Audio(newLecture.audioUrl);
      audio.preload = "metadata";
      audioRef.current = audio;

      // Call play() immediately so mobile browsers authorise it within the
      // user-gesture window. Seeking to the saved position happens once
      // loadedmetadata fires (audio keeps playing from new position).
      audio.play().then(() => setIsPlaying(true)).catch(() => {
        // Autoplay blocked (e.g. no prior user gesture on first load).
        // The loadedmetadata handler will not call play() — user must press
        // the play button manually, but the lecture/mini-bar will still appear.
        setIsPlaying(false);
      });

      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
        setIsLoading(false);
        // Restore saved position (seek without restarting play)
        const saved = localStorage.getItem(posKey(newLecture.id));
        if (saved) {
          const pos = parseFloat(saved);
          if (pos > 0 && pos < audio.duration - 5) {
            audio.currentTime = pos;
            setCurrentTime(pos);
          }
        }
      });

      audio.addEventListener("error", () => {
        setIsLoading(false);
        setIsPlaying(false);
      });

      let marked70 = false;
      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
        if (!marked70 && audio.duration > 0 && audio.currentTime / audio.duration >= 0.7) {
          marked70 = true;
          localStorage.setItem(`bdd_p70_${newLecture.id}`, "1");
        }
      });

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        localStorage.removeItem(posKey(newLecture.id));
        localStorage.setItem(`bdd_pct_${newLecture.id}`, "100");
      });
    },
    [addToHistory]
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    const lec = lectureRef.current;
    const audio = audioRef.current;
    if (lec && audio) {
      localStorage.setItem(posKey(lec.id), String(Math.floor(audio.currentTime)));
      if (audio.duration > 0) {
        const pct = Math.round((audio.currentTime / audio.duration) * 100);
        const existing = parseFloat(localStorage.getItem(`bdd_pct_${lec.id}`) ?? "0") || 0;
        if (pct > existing) localStorage.setItem(`bdd_pct_${lec.id}`, String(pct));
      }
    }
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const stop = useCallback(() => {
    const lec = lectureRef.current;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (lec) localStorage.removeItem(posKey(lec.id));
    lectureRef.current = null;
    setLecture(null);
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const seekToSeconds = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    audio.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const seek = useCallback((pct: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const t = (pct / 100) * audio.duration;
    audio.currentTime = t;
    setCurrentTime(t);
  }, []);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Math.max(0, Math.min(audio.currentTime + seconds, audio.duration));
    audio.currentTime = t;
    setCurrentTime(t);
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }, []);

  return (
    <PlayerContext.Provider
      value={{ lecture, isPlaying, isLoading, currentTime, duration, speed, play, pause, resume, stop, seek, seekToSeconds, skip, setSpeed }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
