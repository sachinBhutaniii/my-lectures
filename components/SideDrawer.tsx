"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useT } from "@/hooks/useT";

interface Props {
  open: boolean;
  onClose: () => void;
  onMediaLibrary: () => void;
  onHistory: () => void;
  onFavourites: () => void;
  onPlaylists: () => void;
  onProfile: () => void;
  onStatistics: () => void;
}

// ── Thin icon wrappers ──────────────────────────────────────────────────────
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-600 flex-shrink-0 text-white">
      {children}
    </span>
  );
}

const icons = {
  mediaLibrary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  ),
  playlists: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h10.5M19.5 12v.75m0 3.75V12m0 0l-2.25 2.25M19.5 12l2.25 2.25" />
    </svg>
  ),
  searchHistory: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v4.5M12 6h.008v.008H12V6zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.75a3 3 0 106 0 3 3 0 00-6 0z" />
    </svg>
  ),
  topLectures: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  statistics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  itinerary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  ),
  gallery: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  contact: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  ),
  language: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
    </svg>
  ),
  interface: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  sync: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

function Divider() {
  return <div className="border-t border-gray-800 mx-4" />;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest text-gray-500 px-5 pt-5 pb-2">
      {label}
    </p>
  );
}

function MenuItem({
  icon,
  label,
  sub,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors text-left"
      >
        <Icon>{icon}</Icon>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-[15px] font-normal">{label}</span>
            {badge && (
              <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                {badge}
              </span>
            )}
          </div>
          {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
        </div>
      </button>
      <Divider />
    </>
  );
}

function formatNow() {
  return new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SideDrawer({ open, onClose, onMediaLibrary, onHistory, onFavourites, onPlaylists, onProfile, onStatistics }: Props) {
  const { user, logout, isAdmin, isProofreader } = useAuth();
  const { lang, setLang } = useLanguage();
  const t = useT();
  const router = useRouter();
  const [now, setNow] = useState("");
  const [showItinerary, setShowItinerary] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => { setNow(formatNow()); }, []);

  function selectLanguage(l: "en" | "hi") {
    setLang(l);
    setShowLanguage(false);
  }

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } finally {
      window.location.reload();
    }
  };

  return (
    <>
      {/* Dark overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 left-0 h-full z-50 w-[78%] max-w-[320px] bg-black flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* ── User profile ── */}
        {user ? (
          /* Logged-in: show backend user */
          <div className="px-5 pt-12 pb-5">
            <button
              onClick={() => { onClose(); onProfile(); }}
              className="flex items-center gap-4 w-full text-left hover:bg-white/5 rounded-xl p-2 -mx-2 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-700 to-amber-500 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-orange-500/50">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xl font-bold select-none">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base leading-tight truncate">{user.name}</p>
                <p className="text-gray-400 text-xs mt-0.5 truncate">{user.email}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <button
              onClick={() => { logout(); onClose(); }}
              className="mt-3 w-full flex items-center justify-center gap-2 text-red-400 text-sm py-2 rounded-xl border border-red-500/20 hover:bg-red-500/10 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              {t("drawer.signOut")}
            </button>
          </div>
        ) : (
          /* Not logged in: show login prompt */
          <div className="px-5 pt-12 pb-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 border-2 border-white/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base">{t("drawer.guest")}</p>
                <p className="text-gray-500 text-xs mt-0.5">{t("drawer.notSignedIn")}</p>
              </div>
            </div>
            <button
              onClick={() => { onClose(); router.push("/login"); }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              {t("drawer.signIn")}
            </button>
          </div>
        )}

        <Divider />

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">
          {/* LECTURE section */}
          <SectionLabel label={t("drawer.sectionLecture")} />

          <MenuItem icon={icons.mediaLibrary} label={t("drawer.mediaLibrary")}    onClick={onMediaLibrary} />
          <MenuItem icon={icons.history}      label={t("drawer.playbackHistory")} onClick={onHistory} />
          <MenuItem icon={icons.heart}        label={t("drawer.favorites")}        onClick={onFavourites} />
          <MenuItem icon={icons.playlists}    label={t("drawer.playlists")}        onClick={onPlaylists} />
          <MenuItem icon={icons.searchHistory} label={t("drawer.searchHistory")} />
          <MenuItem icon={icons.topLectures}  label={t("drawer.topLectures")} />
          <MenuItem icon={icons.statistics}   label={t("drawer.statistics")} onClick={() => { onClose(); onStatistics(); }} />
          <MenuItem icon={icons.itinerary}    label={t("drawer.itinerary")} onClick={() => setShowItinerary(true)} />
          {isAdmin && <MenuItem icon={icons.gallery} label="Gallery" badge="NEW" />}

          {/* BHAKTI VIKĀSA SWAMI section */}
          <SectionLabel label="BHAKTI DHIRA DAMODARA SWAMI" />

          <MenuItem icon={icons.about}   label="About" />
          <MenuItem icon={icons.contact} label="Contact Us" />

          {/* SETTINGS section */}
          <SectionLabel label="SETTINGS" />

          <MenuItem icon={icons.language}  label={t("drawer.language")}  sub={lang === "hi" ? "हिन्दी" : "English"} onClick={() => setShowLanguage(true)} />
          <MenuItem icon={icons.interface} label={t("drawer.interface")}  sub="Default" />
          <MenuItem icon={icons.trash}     label={t("drawer.clearCache")} sub={clearingCache ? "Clearing…" : undefined} onClick={clearingCache ? undefined : handleClearCache} />
          <MenuItem icon={icons.share}     label={t("drawer.share")} badge="Soon" />
          <MenuItem icon={icons.sync}      label="Last Updated On:"          sub={now} />
          <MenuItem icon={icons.clock}     label="Last Lecture Published On:" sub={now} />

          {/* Admin Panel — only for admin */}
          {isAdmin && (
            <>
              <Divider />
              <button
                onClick={() => { onClose(); router.push("/admin"); }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-orange-500/10 transition-colors text-left"
              >
                <span className="w-9 h-9 flex items-center justify-center rounded-full border border-orange-500/60 flex-shrink-0 text-orange-400 bg-orange-500/10">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-orange-400 text-[15px] font-semibold">Admin Panel</span>
                  <p className="text-orange-600 text-xs mt-0.5">Switch to admin mode</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-orange-600 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </>
          )}

          {/* Proofreading Mode — only for proofreaders */}
          {isProofreader && (
            <>
              <Divider />
              <button
                onClick={() => { onClose(); router.push("/proofread"); }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-500/10 transition-colors text-left"
              >
                <span className="w-9 h-9 flex items-center justify-center rounded-full border border-blue-500/60 flex-shrink-0 text-blue-400 bg-blue-500/10">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-blue-400 text-[15px] font-semibold">Proofreading Mode</span>
                  <p className="text-blue-600 text-xs mt-0.5">Review assigned transcripts</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-600 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </>
          )}

          {/* Bottom padding — enough to clear the bottom nav bar */}
          <div className="h-24" />
        </div>
      </div>

      {/* ── Itinerary Coming Soon overlay ── */}
      {showItinerary && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowItinerary(false)} />
          <div className="relative w-full max-w-sm bg-gradient-to-b from-[#1a0d00] to-[#0d0800] border-t border-orange-500/20 rounded-t-3xl px-6 pt-6 pb-12 shadow-2xl mx-auto">
            <div className="w-10 h-1 rounded-full bg-gray-700 mx-auto mb-6" />
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                {icons.itinerary}
              </div>
            </div>
            <h2 className="text-center text-white text-lg font-bold mb-1 tracking-wide">Itinerary</h2>
            <p className="text-center text-orange-400 text-xs font-semibold tracking-widest uppercase mb-4">✦ Sacred Journey ✦</p>
            <p className="text-center text-gray-300 text-sm leading-relaxed mb-2">
              The sacred travel schedule of Śrīla Gurudeva is being lovingly compiled.
            </p>
            <p className="text-center text-gray-400 text-sm leading-relaxed mb-6">
              Soon, the path of the spiritual master will illuminate your screen, guiding sincere seekers to his lotus feet.{" "}
              <span className="text-orange-400 italic">Please be patient, dear devotee.</span>
            </p>
            <p className="text-center text-gray-600 text-xs italic mb-6">
              "yasya prasādād bhagavat-prasādaḥ" — by the grace of the guru, the grace of the Lord is attained.
            </p>
            <button
              onClick={() => setShowItinerary(false)}
              className="w-full py-3 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 font-semibold text-sm hover:bg-orange-500/25 transition-colors active:scale-95"
            >
              Hare Kṛṣṇa 🙏
            </button>
          </div>
        </div>
      )}

      {/* ── Language Selector overlay ── */}
      {showLanguage && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLanguage(false)} />
          <div className="relative w-full max-w-sm bg-gradient-to-b from-[#120c04] to-[#0d0800] border-t border-orange-500/20 rounded-t-3xl px-6 pt-6 pb-12 shadow-2xl mx-auto">
            <div className="w-10 h-1 rounded-full bg-gray-700 mx-auto mb-6" />
            <h2 className="text-center text-white text-lg font-bold mb-1 tracking-wide">{t("drawer.langTitle")}</h2>
            <p className="text-center text-orange-400 text-xs font-semibold tracking-widest uppercase mb-6">{t("drawer.langSubtitle")}</p>

            <div className="space-y-3">
              <button
                onClick={() => selectLanguage("en")}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-colors ${
                  lang === "en"
                    ? "border-orange-500 bg-orange-500/15 text-orange-300"
                    : "border-gray-700 bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                <span className="text-xl">🇬🇧</span>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">English</p>
                  <p className="text-xs text-gray-500 mt-0.5">English</p>
                </div>
                {lang === "en" && (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-orange-400">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => selectLanguage("hi")}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-colors ${
                  lang === "hi"
                    ? "border-amber-500 bg-amber-500/15 text-amber-300"
                    : "border-gray-700 bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                <span className="text-xl">🇮🇳</span>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">हिन्दी</p>
                  <p className="text-xs text-gray-500 mt-0.5">Hindi</p>
                </div>
                {lang === "hi" && (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-400">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
