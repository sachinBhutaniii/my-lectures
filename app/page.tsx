"use client";

import { useState, useMemo, useRef } from "react";
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

      {/* ── Browse by Book ── */}
      <CategoryPicker selected={selectedCategory} onSelect={setSelectedCategory} />

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
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
