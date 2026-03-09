"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LectureVideo, VideoApiResponse } from "@/types/videos";
import { getVideoById, getVideos, getLanguageData } from "@/services/video.service";
import { useFetch } from "@/hooks/useFetch";
import { LanguageData } from "@/types/videos";
import TranscriptView from "@/components/TranscriptView";
import QueueList from "@/components/QueueList";
import PlayerBar from "@/components/PlayerBar";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";
import ShlokaPanel from "@/components/ShlokaPanel";
import { usePlayer } from "@/context/PlayerContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useBackClose } from "@/hooks/useBackClose";

type Tab = "queue" | "transcript";

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
  return `${m}:${s.toString().padStart(2,"0")}`;
}

export default function LecturePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const videoId = Number(params.id);

  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showShlokas, setShowShlokas] = useState(false);
  const { playlists, createPlaylist, addToPlaylist, removeFromPlaylist, lecturePlaylistIds } = usePlaylists();
  const { currentTime, seekToSeconds, isPlaying, isLoading, pause, resume, seek, skip, duration, lecture: playingLecture, play: playerPlay } = usePlayer();

  // ── Back gesture closes active overlay ───────────────────────────────────
  useBackClose(showShlokas, () => setShowShlokas(false));
  useBackClose(showPlaylistModal, () => setShowPlaylistModal(false));
  useBackClose(showLangPicker, () => setShowLangPicker(false));
  const isThisLecture = playingLecture?.id === videoId;
  const progress = isThisLecture && duration > 0 ? (currentTime / duration) * 100 : 0;

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


  // Reading mode is active when auto-scroll is off — compact layout, mini player
  const readingMode = !autoScroll;

  const selectedLangName =
    languages?.find((l) => l.code === selectedLanguage)?.name ?? "English";

  // Auto-play (resume from saved position) when lecture data loads
  useEffect(() => {
    if (lecture?.audioUrl) {
      playerPlay(lecture);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture?.id]);

  const handleBack = useCallback(() => router.back(), [router]);

  return (
    <div className="h-dvh bg-black text-white w-full max-w-4xl xl:max-w-6xl mx-auto flex flex-col overflow-hidden lecture-enter relative z-[55]">
      {/* ── Top header ── */}
      <div className={`flex items-center px-4 gap-3 flex-shrink-0 transition-all duration-300 ${readingMode ? "pt-3 pb-2" : "pt-5 pb-3"}`}>
        {/* Back / minimize */}
        <button onClick={() => router.back()} className="text-gray-300 flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Tab switcher pill — hidden in reading mode */}
        <div className={`flex-1 flex justify-center transition-all duration-300 ${readingMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <div className="bg-gray-800 rounded-full p-1 flex">
            {(["queue", "transcript"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-black text-orange-500"
                    : "text-gray-400"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Transcript toolbar (search + language) — collapses in reading mode ── */}
      {activeTab === "transcript" && (
        <div className={`flex items-stretch gap-2 px-4 flex-shrink-0 transition-all duration-300 ${readingMode ? "max-h-0 opacity-0 pb-0 overflow-hidden" : "max-h-20 opacity-100 pb-3 overflow-visible"}`}>
          {/* Search bar — takes remaining space */}
          <div className="flex-1 flex items-center gap-2 border border-gray-700 rounded-lg px-3 py-3 bg-gray-900/50 min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={transcriptSearch}
              onChange={(e) => setTranscriptSearch(e.target.value)}
              placeholder="Search transcript…"
              className="w-full min-w-0 bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none"
            />
          </div>

          {/* Auto-scroll toggle — icons side by side */}
          <button
            onClick={() => setAutoScroll((v) => !v)}
            title={autoScroll ? "Auto-scroll on — click to lock" : "Scroll locked — click to follow"}
            className={`flex-shrink-0 flex items-center gap-1.5 border rounded-lg px-3 py-3 transition-colors ${
              autoScroll
                ? "border-orange-500 text-orange-400 bg-orange-500/10"
                : "border-gray-700 text-gray-500 bg-gray-900/50"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
            {autoScroll ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                <path d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 01-1.5 0V6.75a3.75 3.75 0 10-7.5 0v3a3 3 0 013 3v6.75a3 3 0 01-3 3H3.75a3 3 0 01-3-3v-6.75a3 3 0 013-3h9v-3c0-2.9 2.35-5.25 5.25-5.25z" />
              </svg>
            )}
          </button>

          {/* Shloka guide button */}
          <button
            onClick={() => setShowShlokas(true)}
            title="Śloka Guide"
            className="flex-shrink-0 h-full flex items-center px-3 border border-gray-700 rounded-lg bg-gray-900/50 text-gray-400 hover:text-orange-400 transition-colors text-sm font-medium"
          >
            ⓘ
          </button>

          {/* Language selector button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowLangPicker((v) => !v)}
              title={selectedLangName}
              className="h-full flex items-center gap-1.5 border border-gray-700 rounded-lg px-3 text-sm text-gray-300 bg-gray-900/50 whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
              </svg>
              <span className="text-xs">{selectedLangName}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 flex-shrink-0">
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
            currentTime={currentTime}
            startTime={lecture?.startTime}
            autoScroll={autoScroll}
            onSeek={seekToSeconds}
          />
        )}

        {!loading && activeTab === "queue" && (
          <QueueList lectures={queueLectures} currentId={videoId} />
        )}
      </div>

      {/* ── Full player bar (hidden in reading mode) ── */}
      <div className={`flex-shrink-0 overflow-hidden transition-all duration-300 ${readingMode ? "max-h-0 opacity-0" : "max-h-64 opacity-100"}`}>
        {lecture && (
          <PlayerBar
            lecture={lecture}
            onPrev={goPrev}
            onNext={goNext}
            onAddToPlaylist={() => setShowPlaylistModal(true)}
          />
        )}
      </div>

      {/* ── Add to Playlist modal ── */}
      {lecture && (
        <AddToPlaylistModal
          open={showPlaylistModal}
          lecture={{ id: lecture.id, title: lecture.title, thumbnailUrl: lecture.thumbnailUrl, addedAt: 0 }}
          playlists={playlists}
          lecturePlaylistIds={lecturePlaylistIds(lecture.id)}
          onClose={() => setShowPlaylistModal(false)}
          onCreate={createPlaylist}
          onToggle={(plId) => {
            const inPlaylist = lecturePlaylistIds(lecture.id).includes(plId);
            if (inPlaylist) removeFromPlaylist(plId, lecture.id);
            else addToPlaylist(plId, { id: lecture.id, title: lecture.title, thumbnailUrl: lecture.thumbnailUrl });
          }}
        />
      )}

      {/* ── Shloka guide panel ── */}
      <ShlokaPanel
        open={showShlokas}
        onClose={() => setShowShlokas(false)}
        videoId={videoId}
        locale={selectedLanguage}
        langName={selectedLangName}
      />

      {/* ── Mini player bar (reading mode only) ── */}
      {readingMode && lecture && (
        <div className="flex-shrink-0 bg-black/95 border-t border-gray-800/60 px-4 pt-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {/* Follow audio button — re-enables autoscroll */}
          <button
            onClick={() => setAutoScroll(true)}
            className="w-full mb-2 flex items-center justify-center gap-1.5 text-xs text-orange-400 border border-orange-500/30 rounded-lg py-1.5 bg-orange-500/5 hover:bg-orange-500/10 transition-colors active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
            Follow audio
          </button>
          {/* Seek bar */}
          <input
            type="range" min={0} max={100} step={0.1}
            value={isThisLecture ? progress : 0}
            onChange={(e) => isThisLecture && seek(Number(e.target.value))}
            className="w-full h-1 mb-3 cursor-pointer rounded-full appearance-none"
            style={{ background: `linear-gradient(to right, #f97316 ${progress}%, #374151 ${progress}%)` }}
          />
          {/* Controls row */}
          <div className="flex items-center justify-between pb-2">
            {/* Time */}
            <span className="text-xs text-gray-500 tabular-nums w-14">
              {isThisLecture ? fmtTime(currentTime) : "0:00"}
            </span>

            {/* Skip back 10s */}
            <button
              onClick={() => isThisLecture && skip(-10)}
              className="text-gray-400 hover:text-white transition-colors relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
            </button>

            {/* Play / Pause */}
            <button
              onClick={() => isThisLecture ? (isPlaying ? pause() : resume()) : undefined}
              className="w-12 h-12 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 flex items-center justify-center shadow-lg shadow-orange-900/40 transition-all"
            >
              {isPlaying && isThisLecture ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Skip forward 10s */}
            <button
              onClick={() => isThisLecture && skip(10)}
              className="text-gray-400 hover:text-white transition-colors relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
            </button>

            {/* Duration */}
            <span className="text-xs text-gray-500 tabular-nums w-14 text-right">
              {isThisLecture && duration > 0 ? fmtTime(duration) : "--:--"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
