"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { LectureVideo } from "@/types/videos";

interface Props {
  lecture: LectureVideo;
  onPrev?: () => void;
  onNext?: () => void;
  onListeningTime?: (seconds: number) => void;
  onTimeUpdate?: (seconds: number) => void;
}

const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerBar({ lecture, onPrev, onNext, onListeningTime, onTimeUpdate }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(2);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const speed = speeds[speedIdx];
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Create / update audio element when audioUrl changes
  useEffect(() => {
    if (!lecture.audioUrl) return;

    const audio = new Audio(lecture.audioUrl);
    audio.preload = "metadata";
    audioRef.current = audio;

    const onLoaded = () => setDuration(audio.duration);
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.src = "";
      audioRef.current = null;
    };
  }, [lecture.audioUrl]);

  // Sync play/pause state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Report time updates to parent
  useEffect(() => {
    onTimeUpdate?.(currentTime);
  }, [currentTime, onTimeUpdate]);

  // Track listening time while playing
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        onListeningTime?.(1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, onListeningTime]);

  const togglePlay = useCallback(() => {
    if (!lecture.audioUrl) return;
    setIsPlaying((v) => !v);
  }, [lecture.audioUrl]);

  const seek = useCallback((pct: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = (pct / 100) * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const cycleSpeed = () => {
    setSpeedIdx((prev) => (prev + 1) % speeds.length);
  };

  return (
    <div className="bg-black border-t border-gray-900 pb-safe">
      {/* Now playing row */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        <img
          src={lecture.thumbnailUrl}
          alt={lecture.title}
          className="w-10 h-10 rounded-md object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{lecture.title}</p>
          {lecture.category && lecture.category.length > 0 && (
            <p className="text-gray-400 text-xs">{lecture.category[0]}</p>
          )}
        </div>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          className="text-orange-400 text-sm font-semibold w-12 text-right"
        >
          {speed.toFixed(2)}x
        </button>

        {/* YouTube link */}
        {lecture.videoUrl && (
          <a
            href={lecture.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-red-600 rounded-md px-1.5 py-1 flex items-center"
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>
        )}

        {/* 3-dot menu */}
        <button className="text-gray-400 text-xl leading-none pl-1">&#x22EE;</button>
      </div>

      {/* Progress bar */}
      <div className="px-3 pb-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full h-1 appearance-none rounded-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, #f97316 ${progress}%, #374151 ${progress}%)`,
            }}
          />
        </div>
        {/* Time row */}
        <div className="flex justify-between items-center mt-1">
          <span className="text-white text-xs font-medium">{formatTime(currentTime)}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-0.5 h-0.5 bg-gray-500 rounded-full" />
            ))}
          </div>
          <span className="text-white text-xs font-medium">{duration > 0 ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Sleep timer */}
        <button className="text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        </button>

        {/* Previous */}
        <button onClick={onPrev} className="text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.34l6.945 3.968c1.25.714 2.805-.188 2.805-1.628V8.688c0-1.44-1.555-2.342-2.805-1.628L12 11.03v-2.34c0-1.44-1.555-2.343-2.805-1.629l-7.108 4.062c-1.26.72-1.26 2.536 0 3.256l7.108 4.061z" />
          </svg>
        </button>

        {/* Rewind 10s */}
        <button onClick={() => skip(-10)} className="text-gray-300 relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${
            lecture.audioUrl
              ? "bg-orange-500 shadow-orange-500/30"
              : "bg-gray-700 shadow-none cursor-not-allowed"
          }`}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-0.5">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Forward 10s */}
        <button onClick={() => skip(10)} className="text-gray-300 relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
        </button>

        {/* Next */}
        <button onClick={onNext} className="text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M5.055 7.06c-1.25-.714-2.805.189-2.805 1.628v8.123c0 1.44 1.555 2.342 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.342 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L14.805 7.06C13.555 6.346 12 7.25 12 8.688v2.34L5.055 7.06z" />
          </svg>
        </button>

        {/* Repeat */}
        <button className="text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>
    </div>
  );
}
