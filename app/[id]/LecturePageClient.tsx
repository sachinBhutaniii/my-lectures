"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LectureVideo, VideoApiResponse } from "@/types/videos";
import { getVideoById, getVideos, getLanguageData } from "@/services/video.service";
import { useFetch } from "@/hooks/useFetch";
import { LanguageData } from "@/types/videos";
import TranscriptView from "@/components/TranscriptView";
import QueueList from "@/components/QueueList";
import PlayerBar from "@/components/PlayerBar";
import { useStreak } from "@/hooks/useStreak";

type Tab = "queue" | "transcript" | "summary";

export default function LecturePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const videoId = Number(params.id);

  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [audioTime, setAudioTime] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const { addListeningTime } = useStreak();

  // Fetch current lecture
  const fetchVideo = useCallback(
    () => getVideoById(videoId, selectedLanguage),
    [videoId, selectedLanguage]
  );
  const { data: lecture, loading } = useFetch<LectureVideo>(fetchVideo);

  // Fetch all lectures for queue
  const { data: allVideos } = useFetch<VideoApiResponse>(getVideos);
  const queueLectures = allVideos?.videos ?? [];

  // Fetch available languages
  const fetchLangs = useCallback(() => getLanguageData(), []);
  const { data: languages } = useFetch<LanguageData[]>(fetchLangs);

  const filteredLangs = (languages ?? []).filter((l) =>
    l.name.toLowerCase().includes(langSearch.toLowerCase())
  );

  // Navigate prev / next in queue
  const currentIdx = queueLectures.findIndex((l) => l.id === videoId);
  const goPrev = () => {
    if (currentIdx > 0) router.push(`/${queueLectures[currentIdx - 1].id}`);
  };
  const goNext = () => {
    if (currentIdx < queueLectures.length - 1)
      router.push(`/${queueLectures[currentIdx + 1].id}`);
  };

  const handleTimeUpdate = useCallback((seconds: number) => {
    setAudioTime(seconds);
  }, []);

  const selectedLangName =
    languages?.find((l) => l.code === selectedLanguage)?.name ?? "English";

  return (
    <div className="h-screen bg-black text-white max-w-md mx-auto flex flex-col overflow-hidden">
      {/* ── Top header ── */}
      <div className="flex items-center px-4 pt-5 pb-3 gap-3 flex-shrink-0">
        {/* Back / minimize */}
        <button onClick={() => router.back()} className="text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Tab switcher pill */}
        <div className="flex-1 flex justify-center">
          <div className="bg-gray-800 rounded-full p-1 flex">
            {(["queue", "transcript", "summary"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-black text-orange-500"
                    : "text-gray-400"
                }`}
              >
                {tab === "summary" ? "Summary ✦" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Transcript toolbar (search + language) ── */}
      {activeTab === "transcript" && (
        <div className="flex items-center gap-2 px-4 pb-3 flex-shrink-0">
          <div className="flex-1 flex items-center gap-2 border border-gray-700 rounded-lg px-3 py-2 bg-gray-900/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={transcriptSearch}
              onChange={(e) => setTranscriptSearch(e.target.value)}
              placeholder="Search transcript…"
              className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none"
            />
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll((v) => !v)}
            title={autoScroll ? "Switch to manual scroll" : "Switch to auto-scroll"}
            className={`flex-shrink-0 flex flex-col items-center gap-0.5 border rounded-lg px-2.5 py-2 transition-colors ${
              autoScroll
                ? "border-orange-500 text-orange-400 bg-orange-500/10"
                : "border-gray-700 text-gray-500 bg-gray-900/50"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
            {autoScroll ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                <path d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 01-1.5 0V6.75a3.75 3.75 0 10-7.5 0v3a3 3 0 013 3v6.75a3 3 0 01-3 3H3.75a3 3 0 01-3-3v-6.75a3 3 0 013-3h9v-3c0-2.9 2.35-5.25 5.25-5.25z" />
              </svg>
            )}
          </button>

          {/* Language selector button */}
          <div className="relative">
            <button
              onClick={() => setShowLangPicker((v) => !v)}
              className="flex items-center gap-1.5 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 bg-gray-900/50 whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
              </svg>
              <span>{selectedLangName}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Language dropdown */}
            {showLangPicker && (
              <div className="absolute right-0 top-12 z-50 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-gray-800">
                  <input
                    type="text"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    placeholder="Search language…"
                    className="w-full bg-gray-800 text-sm text-gray-300 placeholder-gray-600 rounded-lg px-3 py-2 outline-none"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredLangs.length > 0 ? (
                    filteredLangs.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => {
                          setSelectedLanguage(lang.code);
                          setShowLangPicker(false);
                          setLangSearch("");
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          lang.code === selectedLanguage
                            ? "text-orange-400 bg-gray-800"
                            : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))
                  ) : (
                    <p className="text-gray-600 text-sm px-4 py-3">No results</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && activeTab === "transcript" && (
          <TranscriptView
            transcriptSrt={lecture?.transcriptSrt}
            transcript={lecture?.transcript}
            search={transcriptSearch}
            currentTime={audioTime}
            startTime={lecture?.startTime}
            autoScroll={autoScroll}
          />
        )}

        {!loading && activeTab === "queue" && (
          <QueueList lectures={queueLectures} currentId={videoId} />
        )}

        {!loading && activeTab === "summary" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 text-gray-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-gray-600 text-sm">AI Summary coming soon</p>
          </div>
        )}
      </div>

      {/* ── Player bar ── */}
      {lecture && (
        <PlayerBar
          lecture={lecture}
          onPrev={goPrev}
          onNext={goNext}
          onListeningTime={addListeningTime}
          onTimeUpdate={handleTimeUpdate}
        />
      )}
    </div>
  );
}
