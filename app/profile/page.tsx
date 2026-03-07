"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile, Relationship } from "@/hooks/useProfile";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/hooks/useT";
import {
  getVolunteerServices,
  submitVolunteerRequest,
  getMyVolunteerRequests,
  VolunteerServiceItem,
  VolunteerRequestItem,
} from "@/services/volunteer.service";
import { getAllLocales, LocaleInfo } from "@/services/video.service";

// ── Reusable sub-components ───────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#111] rounded-2xl overflow-hidden mb-4">
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-800/60 last:border-0">
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-gray-400 text-xs w-28 flex-shrink-0">{children}</span>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 outline-none"
    />
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
        on ? "bg-orange-500" : "bg-gray-700"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          on ? "translate-x-5.5" : "translate-x-0.5"
        }`}
        style={{ transform: on ? "translateX(20px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function VerifyBadge({
  verified,
  onVerify,
}: {
  verified: boolean;
  onVerify: () => void;
}) {
  const t = useT();
  if (verified) {
    return (
      <span className="flex items-center gap-1 text-green-400 text-xs font-medium flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        {t("profile.verified")}
      </span>
    );
  }
  return (
    <button
      onClick={onVerify}
      className="text-orange-400 text-xs font-semibold border border-orange-500/40 rounded-lg px-2.5 py-1 flex-shrink-0 active:scale-95 transition-transform"
    >
      {t("profile.verify")}
    </button>
  );
}

// RELATIONSHIPS is built inside the component to support t()

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { profile, updateProfile, loaded } = useProfile();
  const { user } = useAuth();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const RELATIONSHIPS: { value: Relationship; label: string; sub?: string }[] = [
    { value: "diksha",   label: t("rel.diksha") },
    { value: "shiksha",  label: t("rel.shiksha"),  sub: t("rel.shikhaSub") },
    { value: "aspiring", label: t("rel.aspiring") },
    { value: "seeker",   label: t("rel.seeker"),   sub: t("rel.seekerSub") },
  ];

  // ── Volunteer / contribute state ────────────────────────────────────────
  const [volServices, setVolServices] = useState<VolunteerServiceItem[]>([]);
  const [myRequests, setMyRequests] = useState<VolunteerRequestItem[]>([]);
  const [volLocales, setVolLocales] = useState<LocaleInfo[]>([]);
  const [volLoading, setVolLoading] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState<Record<number, string[]>>({});
  const [optIn, setOptIn] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!user) return;
    setVolLoading(true);
    Promise.all([
      getVolunteerServices(),
      getMyVolunteerRequests(),
      getAllLocales(),
    ])
      .then(([svcs, reqs, locales]) => {
        setVolServices(svcs);
        setMyRequests(reqs);
        setVolLocales(locales);
      })
      .catch(() => {})
      .finally(() => setVolLoading(false));
  }, [user]);

  const toggleLang = (serviceId: number, code: string) => {
    setSelectedLangs((prev) => {
      const cur = prev[serviceId] ?? [];
      return {
        ...prev,
        [serviceId]: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code],
      };
    });
  };

  const handleSubmitRequest = async (svc: VolunteerServiceItem) => {
    setSubmitting(svc.id);
    setSubmitError((prev) => ({ ...prev, [svc.id]: "" }));
    try {
      const langs =
        svc.slug === "proofreading"
          ? (selectedLangs[svc.id] ?? []).join(",") || null
          : null;
      const newReq = await submitVolunteerRequest(svc.id, langs);
      setMyRequests((prev) => [
        ...prev.filter((r) => r.serviceId !== svc.id),
        newReq,
      ]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setSubmitError((prev) => ({
        ...prev,
        [svc.id]: axiosErr?.response?.data?.error ?? "Failed to submit. Please try again.",
      }));
    } finally {
      setSubmitting(null);
    }
  };

  // When auth user loads, sync their data into profile for any empty fields
  useEffect(() => {
    if (!user || !loaded) return;
    const updates: Parameters<typeof updateProfile>[0] = {};
    if (!profile.legalName.trim() && user.name) updates.legalName = user.name;
    if (!profile.email.trim() && user.email) { updates.email = user.email; updates.emailVerified = true; }
    if (!profile.profilePicture.trim() && user.avatarUrl) updates.profilePicture = user.avatarUrl;
    if (Object.keys(updates).length > 0) updateProfile(updates);
  }, [user, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use auth user data as fallback when profile fields are still empty
  const displayPhoto = profile.profilePicture || user?.avatarUrl || "";
  const displayName = (profile.isInitiated && profile.initiatedName.trim())
    ? profile.initiatedName.trim()
    : profile.legalName.trim() || user?.name || "G";
  const displayEmail = profile.email || user?.email || "";

  const save = useCallback((updates: Parameters<typeof updateProfile>[0]) => {
    updateProfile(updates);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }, [updateProfile]);

  // Profile picture pick
  const handlePicture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => save({ profilePicture: reader.result as string });
    reader.readAsDataURL(file);
  };

  // Auto-detect city + country via Geolocation + Nominatim reverse geocoding
  const detectCity = async () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();
          const city = data.city || data.locality || data.principalSubdivision || "";
          const country = data.countryName || "";
          const updates: Parameters<typeof save>[0] = {};
          if (city) updates.city = city;
          if (country) updates.country = country;
          if (Object.keys(updates).length > 0) save(updates);
        } catch { /* ignore */ }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 }
    );
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white w-full max-w-4xl xl:max-w-6xl mx-auto pb-16">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="text-gray-300 p-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-white text-lg font-semibold">{t("profile.title")}</h1>
        <span
          className={`text-xs font-medium transition-opacity duration-300 ${
            savedFlash ? "text-green-400 opacity-100" : "opacity-0"
          }`}
        >
          {t("profile.saved")}
        </span>
      </div>

      {/* ── Profile picture ── */}
      <div className="flex flex-col items-center py-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative group"
        >
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-orange-500/60 flex items-center justify-center bg-gradient-to-br from-orange-700 to-amber-500">
            {displayPhoto ? (
              <img
                src={displayPhoto}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-3xl font-bold select-none">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {/* Camera overlay */}
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 flex items-center justify-center transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
              <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zM12 10.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" clipRule="evenodd" />
            </svg>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePicture}
        />
        <p className="text-gray-500 text-xs mt-2">{t("profile.tapToChange")}</p>
      </div>

      <div className="px-4 space-y-1">

        {/* ── Personal Info ── */}
        <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-1">{t("profile.personalInfo")}</p>
        <SectionCard>
          <FieldRow>
            <FieldLabel>{t("profile.legalName")}</FieldLabel>
            <TextInput
              value={profile.legalName}
              onChange={(v) => save({ legalName: v })}
              placeholder={user?.name || "Your full legal name"}
            />
          </FieldRow>

          <FieldRow>
            <FieldLabel>{t("profile.initiated")}</FieldLabel>
            <div className="flex-1" />
            <Toggle
              on={profile.isInitiated}
              onToggle={() => save({ isInitiated: !profile.isInitiated })}
            />
          </FieldRow>

          {profile.isInitiated && (
            <FieldRow>
              <FieldLabel>{t("profile.initiatedName")}</FieldLabel>
              <TextInput
                value={profile.initiatedName}
                onChange={(v) => save({ initiatedName: v })}
                placeholder="e.g. Garga Muni Das"
              />
            </FieldRow>
          )}
        </SectionCard>

        {/* ── Contact ── */}
        <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-3">{t("profile.contact")}</p>
        <SectionCard>
          <FieldRow>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
            </svg>
            <TextInput
              value={profile.whatsapp}
              onChange={(v) => save({ whatsapp: v, whatsappVerified: false })}
              placeholder={t("profile.whatsappPlaceholder")}
              type="tel"
            />
            <VerifyBadge
              verified={profile.whatsappVerified}
              onVerify={() => {
                if (profile.whatsapp.trim().length >= 7)
                  save({ whatsappVerified: true });
              }}
            />
          </FieldRow>

          <FieldRow>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f97316" className="w-4 h-4 flex-shrink-0">
              <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
              <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
            </svg>
            <TextInput
              value={displayEmail}
              onChange={(v) => save({ email: v, emailVerified: false })}
              placeholder={t("profile.emailPlaceholder")}
              type="email"
            />
            <VerifyBadge
              verified={profile.emailVerified || !!user?.email}
              onVerify={() => {
                if (displayEmail.includes("@"))
                  save({ emailVerified: true });
              }}
            />
          </FieldRow>
        </SectionCard>

        {/* ── Location ── */}
        <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-3">{t("profile.location")}</p>
        <SectionCard>
          <FieldRow>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f97316" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.083 3.938-5.093 3.938-9.327A8.25 8.25 0 003 12c0 4.234 1.994 7.244 3.937 9.327a19.58 19.58 0 002.683 2.282 16.974 16.974 0 001.144.742zM12 14.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
            </svg>
            <TextInput
              value={profile.city}
              onChange={(v) => save({ city: v })}
              placeholder={t("profile.cityPlaceholder")}
            />
            <button
              onClick={detectCity}
              disabled={locating}
              className="flex items-center gap-1 text-orange-400 text-xs font-semibold border border-orange-500/40 rounded-lg px-2.5 py-1 flex-shrink-0 active:scale-95 transition-transform disabled:opacity-50"
            >
              {locating ? (
                <span className="w-3 h-3 border border-orange-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.757.433c.114.06.22.111.308.139l.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                </svg>
              )}
              {locating ? t("profile.detecting") : t("profile.auto")}
            </button>
          </FieldRow>
          <FieldRow>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f97316" className="w-4 h-4 flex-shrink-0">
              <path d="M15.75 8.25a.75.75 0 01.75.75c0 1.12-.492 2.126-1.27 2.812a.75.75 0 11-.992-1.124A2.243 2.243 0 0015 9a.75.75 0 01.75-.75z" />
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM4.575 15.6a8.25 8.25 0 009.348 4.425 1.966 1.966 0 00-1.84-1.275.983.983 0 01-.97-.822l-.073-.437c-.094-.565.25-1.11.8-1.267l.99-.282c.427-.123.783-.418.982-.816l.036-.073a1.453 1.453 0 012.328-.377L16.5 15h.628a2.25 2.25 0 011.983 1.186 8.25 8.25 0 00-6.345-12.4c.03.489-.013.987-.14 1.479-.19.731-.692 1.338-1.37 1.671l-.534.268a1.5 1.5 0 00-.83 1.342v.943a1.5 1.5 0 01-.44 1.06l-.739.74a1.5 1.5 0 01-1.06.44h-.689a1.5 1.5 0 01-1.484-1.309l-.065-.523a1.5 1.5 0 00-.758-1.152A8.225 8.225 0 004.575 15.6z" clipRule="evenodd" />
            </svg>
            <TextInput
              value={profile.country}
              onChange={(v) => save({ country: v })}
              placeholder={t("profile.countryPlaceholder")}
            />
          </FieldRow>
        </SectionCard>

        {/* ── Relationship ── */}
        <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-3">{t("profile.yourConnection")}</p>
        <p className="text-gray-400 text-xs mb-3 leading-relaxed">
          What is your relationship with{" "}
          <span className="text-white font-medium">
            His Holiness Bhakti Dhira Damodar Swami Maharaj?
          </span>
        </p>
        <SectionCard>
          {RELATIONSHIPS.map((rel, i) => (
            <button
              key={rel.value}
              onClick={() => save({ relationship: rel.value })}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors ${
                i < RELATIONSHIPS.length - 1 ? "border-b border-gray-800/60" : ""
              } ${profile.relationship === rel.value ? "bg-orange-500/10" : "hover:bg-white/5"}`}
            >
              {/* Radio circle */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  profile.relationship === rel.value
                    ? "border-orange-500"
                    : "border-gray-600"
                }`}
              >
                {profile.relationship === rel.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${profile.relationship === rel.value ? "text-orange-400" : "text-white"}`}>
                  {rel.label}
                </p>
                {rel.sub && (
                  <p className="text-gray-500 text-xs mt-0.5">{rel.sub}</p>
                )}
              </div>
            </button>
          ))}
        </SectionCard>

        {/* ── Contribute to the Mission ── */}
        {user && (
          <>
            <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-5">
              {t("profile.contribute")}
            </p>
            <p className="text-gray-400 text-xs mb-4 leading-relaxed">
              Wish to grow this service? Use your skills in the{" "}
              <span className="text-orange-400 font-medium">service of the mission</span>.
            </p>

            {volLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : volServices.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">
                No volunteer opportunities available right now.
              </p>
            ) : (
              <div className="space-y-3">
                {volServices.map((svc) => {
                  const isProofreading = svc.slug === "proofreading";
                  const req = myRequests.find((r) => r.serviceId === svc.id);
                  const canReapply =
                    req?.status === "REJECTED" &&
                    (!req.canReapplyAt || new Date(req.canReapplyAt) <= new Date());
                  const showForm = !req || canReapply;
                  const withinCooldown =
                    req?.status === "REJECTED" &&
                    req.canReapplyAt &&
                    new Date(req.canReapplyAt) > new Date();
                  const isOptIn = optIn[svc.id] ?? false;

                  // Proofreading card — uses special title, description, toggle, and messaging
                  if (isProofreading) {
                    return (
                      <SectionCard key={svc.id}>
                        <div className="px-4 py-4">
                          {/* Title + toggle */}
                          <div className="flex items-start gap-3 mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white leading-snug">
                                Want to be a Transcription Sevak?
                              </p>
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed italic">
                                Listen. Refine. Serve. Become a guardian of divine words.
                              </p>
                            </div>
                            {/* Toggle — only show when no active/pending request */}
                            {showForm && (
                              <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                                <Toggle
                                  on={isOptIn}
                                  onToggle={() =>
                                    setOptIn((prev) => ({ ...prev, [svc.id]: !isOptIn }))
                                  }
                                />
                                <span className="text-[9px] text-gray-600 uppercase tracking-wide">
                                  {isOptIn ? "Yes!" : "No"}
                                </span>
                              </div>
                            )}
                            {/* Status badge when request exists */}
                            {req && !canReapply && (
                              <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                req.status === "PENDING"
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                  : req.status === "APPROVED"
                                  ? "border-green-500/40 bg-green-500/10 text-green-400"
                                  : "border-red-500/40 bg-red-500/10 text-red-400"
                              }`}>
                                {req.status === "PENDING" ? "In Review"
                                  : req.status === "APPROVED" ? "Approved"
                                  : "Rejected"}
                              </span>
                            )}
                          </div>

                          {/* ── APPROVED state ── */}
                          {req?.status === "APPROVED" && !canReapply && (
                            <div className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/25">
                              <p className="text-xs text-green-300 font-medium leading-relaxed">
                                🎉 Congratulations! You are on board with other transcription sevaks.
                              </p>
                              {req.approvedLanguages && (
                                <p className="text-[10px] text-green-500/70 mt-1.5">
                                  Approved for:{" "}
                                  <span className="font-medium text-green-400">
                                    {req.approvedLanguages.split(",").map((c) => c.trim()).join(", ")}
                                  </span>
                                </p>
                              )}
                              {req.adminMessage && (
                                <p className="text-xs text-green-400/70 mt-2 italic">"{req.adminMessage}"</p>
                              )}
                            </div>
                          )}

                          {/* ── PENDING state ── */}
                          {req?.status === "PENDING" && (
                            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                              <p className="text-xs text-amber-300 leading-relaxed">
                                🙏 Hold on! We are thinking about you.
                              </p>
                              {req.languages && (
                                <p className="text-[10px] text-amber-500/60 mt-1.5">
                                  Requested for:{" "}
                                  <span className="font-medium text-amber-400/80">
                                    {req.languages.split(",").map((c) => c.trim()).join(", ")}
                                  </span>
                                </p>
                              )}
                            </div>
                          )}

                          {/* ── REJECTED state ── */}
                          {req?.status === "REJECTED" && !canReapply && (
                            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                              <p className="text-xs text-red-300 font-medium mb-1">Request Declined</p>
                              {req.adminMessage ? (
                                <p className="text-xs text-red-300/80 leading-relaxed italic">
                                  "{req.adminMessage}"
                                </p>
                              ) : (
                                <p className="text-xs text-red-400/60">
                                  No reason provided.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Cooldown countdown */}
                          {withinCooldown && (
                            <p className="text-xs text-gray-600 mt-2">
                              You can reapply in{" "}
                              <span className="text-gray-400 font-medium">
                                {formatCountdown(req!.canReapplyAt!)}
                              </span>
                            </p>
                          )}

                          {/* Language picker — show when opted in and form is visible */}
                          {showForm && isOptIn && volLocales.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                                Choose your languages
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {volLocales.map((l) => {
                                  const selected = (selectedLangs[svc.id] ?? []).includes(l.code);
                                  return (
                                    <button
                                      key={l.id}
                                      onClick={() => toggleLang(svc.id, l.code)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                        selected
                                          ? "border-orange-500/50 bg-orange-500/20 text-orange-300"
                                          : "border-gray-700 bg-gray-800/80 text-gray-400 active:scale-95"
                                      }`}
                                    >
                                      {l.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Submit button */}
                          {showForm && isOptIn && (
                            <button
                              onClick={() => handleSubmitRequest(svc)}
                              disabled={submitting === svc.id}
                              className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold border border-orange-500/60 text-orange-300 bg-orange-500/15 active:bg-orange-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {submitting === svc.id ? (
                                <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.516 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
                                  </svg>
                                  {canReapply ? "Apply Again" : "Join the Sewa"}
                                </>
                              )}
                            </button>
                          )}

                          {/* Error */}
                          {submitError[svc.id] && (
                            <p className="text-xs text-red-400 mt-2">{submitError[svc.id]}</p>
                          )}
                        </div>
                      </SectionCard>
                    );
                  }

                  // ── Generic volunteer service card ──────────────────────────
                  return (
                    <SectionCard key={svc.id}>
                      <div className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-sm font-semibold text-white">{svc.name}</p>
                          {req && !canReapply && (
                            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              req.status === "PENDING"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                : req.status === "APPROVED"
                                ? "border-green-500/40 bg-green-500/10 text-green-400"
                                : "border-red-500/40 bg-red-500/10 text-red-400"
                            }`}>
                              {req.status === "PENDING" ? "In Review"
                                : req.status === "APPROVED" ? "Approved"
                                : "Declined"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">{svc.description}</p>

                        {req?.status === "APPROVED" && req.adminMessage && (
                          <div className="mb-3 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                            <p className="text-xs text-green-300 leading-relaxed">"{req.adminMessage}"</p>
                          </div>
                        )}
                        {req?.status === "REJECTED" && req.adminMessage && (
                          <div className="mb-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                            <p className="text-xs text-red-300 leading-relaxed">"{req.adminMessage}"</p>
                          </div>
                        )}
                        {withinCooldown && (
                          <p className="text-xs text-gray-600 mb-3">
                            You can reapply in{" "}
                            <span className="text-gray-400 font-medium">
                              {formatCountdown(req!.canReapplyAt!)}
                            </span>
                          </p>
                        )}
                        {showForm && (
                          <button
                            onClick={() => handleSubmitRequest(svc)}
                            disabled={submitting === svc.id}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-orange-500/40 text-orange-400 bg-orange-500/10 active:bg-orange-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {submitting === svc.id ? (
                              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>{canReapply ? "Apply Again" : "Submit Application"}</>
                            )}
                          </button>
                        )}
                        {submitError[svc.id] && (
                          <p className="text-xs text-red-400 mt-2">{submitError[svc.id]}</p>
                        )}
                      </div>
                    </SectionCard>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Bottom breathing room */}
        <div className="h-6" />
      </div>
    </div>
  );
}
