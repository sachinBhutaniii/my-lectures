"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/useT";
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
import DownloadsPanel from "@/components/DownloadsPanel";
import { useDownloads } from "@/hooks/useDownloads";
import NewContentPanel from "@/components/NewContentPanel";
import { useBackClose } from "@/hooks/useBackClose";

export default function Home() {
  const router = useRouter();
  const t = useT();
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
  const [showDownloads, setShowDownloads] = useState(false);
  const { downloads, isDownloaded, getDownloadProgress, downloadLecture, deleteDownload, getBlobUrl } = useDownloads();
  const [todayWisdom, setTodayWisdom] = useState<ReturnType<typeof getWisdomForToday> | null>(null);

  // ── New-content notification ─────────────────────────────────────────────
  const [showNotifications, setShowNotifications] = useState(false);
  const [prevMaxId, setPrevMaxId] = useState<number>(0);
  const [notifSnapshot, setNotifSnapshot] = useState<typeof lectures>([]);

  // ── Back gesture closes active overlay ───────────────────────────────────
  useBackClose(menuOpen, () => setMenuOpen(false));
  useBackClose(showHistory, () => setShowHistory(false));
  useBackClose(showFavourites, () => setShowFavourites(false));
  useBackClose(showPlaylists, () => setShowPlaylists(false));
  useBackClose(showStreak, () => setShowStreak(false));
  useBackClose(showWisdom, () => setShowWisdom(false));
  useBackClose(showBhajansModal, () => setShowBhajansModal(false));
  useBackClose(showDownloads, () => setShowDownloads(false));
  useBackClose(showNotifications, () => setShowNotifications(false));
  useBackClose(!!playlistTarget, () => setPlaylistTarget(null));

  // Client-only: pick wisdom + auto-show once per session
  useEffect(() => {
    const w = getWisdomForToday();
    setTodayWisdom(w);
    if (!sessionStorage.getItem("bdd_wisdom_shown")) {
      sessionStorage.setItem("bdd_wisdom_shown", "1");
      setShowWisdom(true);
    }
  }, []);

  // Load last-seen video ID from localStorage (0 = first visit, no badge shown)
  useEffect(() => {
    const stored = parseInt(localStorage.getItem("bdd_last_seen_video_id") ?? "0", 10);
    setPrevMaxId(stored);
  }, []);

  const lectures = data?.videos ?? [];

  // Badge count: videos with ID higher than what was seen on last visit
  const newCount = prevMaxId === 0 ? 0 : lectures.filter((l) => l.id > prevMaxId).length;

  const handleOpenNotifications = () => {
    const newItems = lectures
      .filter((l) => l.id > prevMaxId)
      .sort((a, b) => b.id - a.id);
    setNotifSnapshot(newItems);
    setShowNotifications(true);
    // Mark all current lectures as seen
    if (lectures.length > 0) {
      const maxId = Math.max(...lectures.map((l) => l.id));
      localStorage.setItem("bdd_last_seen_video_id", String(maxId));
      setPrevMaxId(maxId);
    }
  };

  const lecturesSectionRef = useRef<HTMLDivElement>(null);
  const { history, addToHistory, clearHistory } = usePlaybackHistory();
  const { favouriteItems, isFavourite, toggleFavourite } = useFavourites();
  const { playlists, createPlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, lecturePlaylistIds } = usePlaylists();
  const { streakData } = useStreak();

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
    <div className="min-h-screen bg-[#1a1208] text-white w-full max-w-4xl xl:max-w-6xl mx-auto relative">
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
        onStatistics={() => { setMenuOpen(false); setShowStreak(true); }}
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
          <div className="relative w-full max-w-xl bg-gradient-to-b from-[#1a0d00] to-[#0d0800] border-t border-orange-500/20 rounded-t-3xl px-6 pt-6 pb-28 shadow-2xl">
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

      {/* ── New Content Panel ── */}
      <NewContentPanel
        open={showNotifications}
        items={notifSnapshot}
        onClose={() => setShowNotifications(false)}
        onLectureClick={(lecture) => {
          addToHistory(lecture);
          router.push(`/${lecture.id}`);
        }}
      />

      {/* ── Downloads Panel ── */}
      <DownloadsPanel
        open={showDownloads}
        onClose={() => setShowDownloads(false)}
        downloads={downloads}
        onDelete={deleteDownload}
        getBlobUrl={getBlobUrl}
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
          <span className="text-xl font-semibold tracking-wide">{t("home.title")}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <button
            onClick={handleOpenNotifications}
            title="What's new"
            className="relative w-10 h-10 rounded-full flex items-center justify-center bg-gray-800/60 border border-gray-700 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-gray-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            {newCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {newCount > 9 ? "9+" : newCount}
              </span>
            )}
          </button>

          {/* Streak / Flame button */}
          <button
            onClick={() => setShowStreak(true)}
            title="View streak"
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              streakData.currentStreak > 0 || streakData.listenedToday
                ? "bg-orange-500/15 border border-orange-500/40"
                : "bg-gray-800/60 border border-gray-700"
            }`}
          >
            <FlameIcon
              size={22}
              lit={streakData.currentStreak > 0 || streakData.listenedToday}
              animated
            />
            {streakData.currentStreak > 0 && (
              <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {streakData.currentStreak}
              </span>
            )}
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
              {t("home.wisdomOfTheDay")}
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

      {/* ── Lectures section ── */}
      <div ref={lecturesSectionRef} className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-semibold tracking-wide">{t("home.lectures")}</span>
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
              isDownloaded={isDownloaded(lecture.id)}
              downloadProgress={getDownloadProgress(lecture.id)}
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
              onDownload={() => downloadLecture(lecture)}
              onDeleteDownload={() => deleteDownload(lecture.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "bhajans") { setShowBhajansModal(true); return; }
          if (tab === "jnana") { router.push("/jnana-yagya"); return; }
          if (tab === "sadhna") { router.push("/sadhana"); return; }
          if (tab === "downloads") { setShowDownloads(true); return; }
          setActiveTab(tab);
        }}
      />
    </div>
  );
}
