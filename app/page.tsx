"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlaybackHistory } from "@/hooks/usePlaybackHistory";
import { useFavourites } from "@/hooks/useFavourites";
import { usePlaylists } from "@/hooks/usePlaylists";
import { PlaylistLecture } from "@/hooks/usePlaylists";
import { useStreak } from "@/hooks/useStreak";
import { useFetch } from "@/hooks/useFetch";
import { getVideos } from "@/services/video.service";
import { VideoApiResponse } from "@/types/videos";
import SearchBar from "@/components/SearchBar";
import FestivalCarousel from "@/components/FestivalCarousel";
import CategoryPicker, { CATEGORIES } from "@/components/CategoryPicker";
import LectureCard from "@/components/LectureCard";
import BottomNav from "@/components/BottomNav";
import SideDrawer from "@/components/SideDrawer";
import HistoryPanel from "@/components/HistoryPanel";
import FavouritesPanel from "@/components/FavouritesPanel";
import PlaylistsPanel from "@/components/PlaylistsPanel";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";
import FlameIcon from "@/components/FlameIcon";
import StreakPanel from "@/components/StreakPanel";
import WisdomModal, { getWisdomForToday } from "@/components/WisdomModal";

export default function Home() {
  const router = useRouter();
  const { data, loading } = useFetch<VideoApiResponse>(getVideos);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("media");
  const [sortAsc, setSortAsc] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showStreak, setShowStreak] = useState(false);
  const [playlistTarget, setPlaylistTarget] = useState<PlaylistLecture | null>(null);
  const [showWisdom, setShowWisdom] = useState(false);
  const [showBhajansModal, setShowBhajansModal] = useState(false);
  const [todayWisdom, setTodayWisdom] = useState<ReturnType<typeof getWisdomForToday> | null>(null);

  // Client-only: pick wisdom + auto-show once per session
  useEffect(() => {
    const w = getWisdomForToday();
    setTodayWisdom(w);
    if (!sessionStorage.getItem("bdd_wisdom_shown")) {
      sessionStorage.setItem("bdd_wisdom_shown", "1");
      setShowWisdom(true);
    }
  }, []);

  const lecturesSectionRef = useRef<HTMLDivElement>(null);
  const { history, addToHistory, clearHistory } = usePlaybackHistory();
  const { favouriteItems, isFavourite, toggleFavourite } = useFavourites();
  const { playlists, createPlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, lecturePlaylistIds } = usePlaylists();
  const { streakData } = useStreak();

  const lectures = data?.videos ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    // Determine which keyword list to use for category filtering
    const activeCat = selectedCategory
      ? CATEGORIES.find((c) => c.id === selectedCategory)
      : null;

    return lectures.filter((l) => {
      // Text search
      const matchesSearch =
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.place?.city?.toLowerCase().includes(q) ||
        l.category?.some((c) => c.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Category filter
      if (!activeCat) return true;

      const cats = (l.category ?? []).map((c) => c.toLowerCase());
      const titleLower = l.title.toLowerCase();

      if (activeCat.id === "others") {
        // "Others" = doesn't match any named category
        return !CATEGORIES.slice(0, 4).some((namedCat) =>
          namedCat.keywords.some(
            (kw) => cats.some((c) => c.includes(kw)) || titleLower.includes(kw)
          )
        );
      }

      return activeCat.keywords.some(
        (kw) => cats.some((c) => c.includes(kw)) || titleLower.includes(kw)
      );
    });
  }, [lectures, search, selectedCategory]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortAsc ? -diff : diff;
    });
  }, [filtered, sortAsc]);

  return (
    <div className="min-h-screen bg-[#1a1208] text-white max-w-md mx-auto relative">
      {/* ── Wisdom of the Day ── */}
      <WisdomModal open={showWisdom} onClose={() => setShowWisdom(false)} />

      {/* ── Side Drawer ── */}
      <SideDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onMediaLibrary={() => {
          setMenuOpen(false);
          setTimeout(() => lecturesSectionRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
        }}
        onHistory={() => { setMenuOpen(false); setShowHistory(true); }}
        onFavourites={() => { setMenuOpen(false); setShowFavourites(true); }}
        onPlaylists={() => { setMenuOpen(false); setShowPlaylists(true); }}
        onProfile={() => { setMenuOpen(false); router.push("/profile"); }}
      />

      {/* ── Playback History Panel ── */}
      <HistoryPanel
        open={showHistory}
        history={history}
        onClose={() => setShowHistory(false)}
        onClear={clearHistory}
      />

      {/* ── Favourites Panel ── */}
      <FavouritesPanel
        open={showFavourites}
        items={favouriteItems}
        onClose={() => setShowFavourites(false)}
        onUnfavourite={(id) => {
          const lecture = favouriteItems.find((f) => f.id === id);
          if (lecture) toggleFavourite(lecture);
        }}
      />

      {/* ── Playlists Panel ── */}
      <PlaylistsPanel
        open={showPlaylists}
        playlists={playlists}
        onClose={() => setShowPlaylists(false)}
        onDelete={deletePlaylist}
        onRemoveLecture={removeFromPlaylist}
        onCreatePlaylist={createPlaylist}
      />

      {/* ── Bhajans Coming Soon Modal ── */}
      {showBhajansModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBhajansModal(false)} />
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#1a0d00] to-[#0d0800] border-t border-orange-500/20 rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl">
            {/* Handle bar */}
            <div className="w-10 h-1 rounded-full bg-gray-700 mx-auto mb-6" />
            {/* Musical note emblem */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="#f97316" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
              </div>
            </div>
            <h2 className="text-center text-white text-lg font-bold mb-1 tracking-wide">Bhajans</h2>
            <p className="text-center text-orange-400 text-xs font-semibold tracking-widest uppercase mb-4">✦ Sacred Kīrtana ✦</p>
            <p className="text-center text-gray-300 text-sm leading-relaxed mb-2">
              The sacred melodies of the Lord are being lovingly gathered.
            </p>
            <p className="text-center text-gray-400 text-sm leading-relaxed mb-6">
              Soon, the transcendental vibrations of kīrtana will fill your heart and purify your consciousness. <span className="text-orange-400 italic">Please be patient, dear devotee.</span>
            </p>
            <p className="text-center text-gray-600 text-xs italic mb-6">
              "nāma-saṅkīrtanaṁ yasya sarva-pāpa praṇāśanam" — all sins are destroyed by the congregational chanting of the Lord's names.
            </p>
            <button
              onClick={() => setShowBhajansModal(false)}
              className="w-full py-3 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 font-semibold text-sm hover:bg-orange-500/25 transition-colors active:scale-95"
            >
              Hare Kṛṣṇa 🙏
            </button>
          </div>
        </div>
      )}

      {/* ── Streak Panel ── */}
      <StreakPanel
        open={showStreak}
        onClose={() => setShowStreak(false)}
        streakData={streakData}
      />

      {/* ── Add to Playlist Modal ── */}
      <AddToPlaylistModal
        open={playlistTarget !== null}
        lecture={playlistTarget}
        playlists={playlists}
        lecturePlaylistIds={playlistTarget ? lecturePlaylistIds(playlistTarget.id) : []}
        onClose={() => setPlaylistTarget(null)}
        onCreate={(name) => {
          const pl = createPlaylist(name);
          if (playlistTarget) addToPlaylist(pl.id, playlistTarget);
        }}
        onToggle={(playlistId) => {
          if (!playlistTarget) return;
          const inList = lecturePlaylistIds(playlistTarget.id).includes(playlistId);
          if (inList) removeFromPlaylist(playlistId, playlistTarget.id);
          else addToPlaylist(playlistId, playlistTarget);
        }}
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="text-xl font-semibold tracking-wide">Home</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Placeholder avatar chips */}
          <div className="flex items-center gap-1.5">
            {["New", "AI"].map((label) => (
              <div
                key={label}
                className="w-9 h-9 rounded-full border-2 border-orange-500 bg-[#2a1a08] flex items-center justify-center"
              >
                <span className="text-[9px] font-bold text-orange-400">{label}</span>
              </div>
            ))}
          </div>

          {/* Streak / Flame button */}
          <button
            onClick={() => setShowStreak(true)}
            className="relative flex items-center gap-1 ml-1"
            title="View streak"
          >
            <FlameIcon
              size={26}
              lit={streakData.currentStreak > 0 || streakData.listenedToday}
              animated
            />
            {streakData.currentStreak > 0 && (
              <span className="text-orange-400 text-xs font-bold leading-none">
                {streakData.currentStreak}
              </span>
            )}
          </button>

          <button className="text-gray-400 ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M12 6a2 2 0 110-4 2 2 0 010 4zM12 14a2 2 0 110-4 2 2 0 010 4zM12 22a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <SearchBar value={search} onChange={setSearch} />

      {/* ── Festival Carousel ── */}
      <FestivalCarousel
        lectures={lectures.slice(0, 8)}
        onSelect={(lecture) => router.push(`/${lecture.id}`)}
      />

      {/* ── Wisdom of the Day card ── */}
      {todayWisdom && (
        <button
          onClick={() => setShowWisdom(true)}
          className="mx-4 mt-4 w-[calc(100%-2rem)] flex items-center gap-4 bg-[#1c1106] border border-orange-500/20 rounded-2xl px-4 py-3.5 text-left hover:border-orange-500/40 active:scale-[0.98] transition-all"
        >
          <span className="text-3xl leading-none flex-shrink-0 select-none">{todayWisdom.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-orange-500 text-[10px] font-bold tracking-widest uppercase mb-0.5">
              ✦ Wisdom of the Day
            </p>
            <p className="text-white text-sm font-semibold leading-snug truncate">{todayWisdom.title}</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-snug line-clamp-1">{todayWisdom.body}</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-orange-500 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* ── Browse by Book ── */}
      <CategoryPicker selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* ── Jñāna Yajña — Knowledge Test section ── */}
      <div className="px-4 mt-6 mb-2">
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#1c1300] to-[#120e00] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-amber-500/10">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" className="w-5 h-5">
                <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 font-bold text-sm tracking-wide">Jñāna Yajña</p>
              <p className="text-amber-700 text-[10px] tracking-widest uppercase">Sacrifice of Knowledge</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 tracking-wide">
              COMING SOON
            </span>
          </div>
          {/* Body */}
          <div className="px-4 py-4">
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              Test your realizations from the sacred scriptures — Bhagavad-gītā, Śrīmad-Bhāgavatam, and more.
            </p>
            <p className="text-gray-600 text-xs italic leading-relaxed">
              "jñāna-yajñena cāpy anye yajanto mām upāsate" — others worship Me by the yajña of knowledge.
              <span className="text-amber-800"> — Bhagavad-gītā 9.15</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Lectures section ── */}
      <div ref={lecturesSectionRef} className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-semibold tracking-wide">Lectures</span>
          <div className="flex items-center gap-3">
            {/* Sort toggle */}
            <button
              onClick={() => setSortAsc((v) => !v)}
              title={sortAsc ? "Oldest first" : "Newest first"}
              className="text-gray-300 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
              </svg>
            </button>
            {/* Filter icon */}
            <button className="text-gray-300 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M10.5 12h3m-4.5 5.25h6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#241a0e] rounded-xl p-3 animate-pulse h-24" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && sorted.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">No lectures found</p>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="mt-2 text-orange-400 text-xs underline"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* Lecture cards */}
        <div className="pb-36">
          {sorted.map((lecture) => (
            <LectureCard
              key={lecture.id}
              lecture={lecture}
              isActive={false}
              isFavourite={isFavourite(lecture.id)}
              onClick={() => {
                addToHistory(lecture);
                router.push(`/${lecture.id}`);
              }}
              onToggleFavourite={() => toggleFavourite(lecture)}
              onAddToPlaylist={() => setPlaylistTarget({
                id: lecture.id,
                title: lecture.title,
                thumbnailUrl: lecture.thumbnailUrl,
                category: lecture.category,
                date: lecture.date,
                place: lecture.place,
                speaker: lecture.speaker,
                addedAt: Date.now(),
              })}
            />
          ))}
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "bhajans") { setShowBhajansModal(true); return; }
          setActiveTab(tab);
        }}
      />
    </div>
  );
}
