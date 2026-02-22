"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProfile, Relationship } from "@/hooks/useProfile";

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
  if (verified) {
    return (
      <span className="flex items-center gap-1 text-green-400 text-xs font-medium flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        Verified
      </span>
    );
  }
  return (
    <button
      onClick={onVerify}
      className="text-orange-400 text-xs font-semibold border border-orange-500/40 rounded-lg px-2.5 py-1 flex-shrink-0 active:scale-95 transition-transform"
    >
      Verify
    </button>
  );
}

// Relationship options
const RELATIONSHIPS: { value: Relationship; label: string; sub?: string }[] = [
  { value: "diksha",   label: "Diksha Disciple" },
  { value: "shiksha",  label: "Shiksha Disciple", sub: "Initiated by another Guru" },
  { value: "aspiring", label: "Aspiring Disciple" },
  { value: "seeker",   label: "Seeker", sub: "Not decided yet" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { profile, updateProfile, loaded } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

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

  // Auto-detect city via Geolocation + Nominatim reverse geocoding
  const detectCity = async () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            "";
          if (city) save({ city });
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
    <div className="min-h-screen bg-[#0a0a0a] text-white max-w-md mx-auto pb-16">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="text-gray-300 p-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-white text-lg font-semibold">My Profile</h1>
        <span
          className={`text-xs font-medium transition-opacity duration-300 ${
            savedFlash ? "text-green-400 opacity-100" : "opacity-0"
          }`}
        >
          Saved ✓
        </span>
      </div>

      {/* ── Profile picture ── */}
      <div className="flex flex-col items-center py-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative group"
        >
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-orange-500/60 flex items-center justify-center bg-gradient-to-br from-orange-700 to-amber-500">
            {profile.profilePicture ? (
              <img
                src={profile.profilePicture}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-3xl font-bold select-none">
                {(profile.isInitiated && profile.initiatedName
                  ? profile.initiatedName
                  : profile.legalName || "G"
                ).charAt(0).toUpperCase()}
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
        <p className="text-gray-500 text-xs mt-2">Tap to change photo</p>
      </div>

      <div className="px-4 space-y-1">

        {/* ── Personal Info ── */}
        <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-1">PERSONAL INFO</p>
        <SectionCard>
          <FieldRow>
            <FieldLabel>Legal Name</FieldLabel>
            <TextInput
              value={profile.legalName}
              onChange={(v) => save({ legalName: v })}
              placeholder="Your full legal name"
            />
          </FieldRow>

          <FieldRow>
            <FieldLabel>Initiated</FieldLabel>
            <div className="flex-1" />
            <Toggle
              on={profile.isInitiated}
              onToggle={() => save({ isInitiated: !profile.isInitiated })}
            />
          </FieldRow>

          {profile.isInitiated && (
            <FieldRow>
              <FieldLabel>Initiated Name</FieldLabel>
              <TextInput
                value={profile.initiatedName}
                onChange={(v) => save({ initiatedName: v })}
                placeholder="e.g. Garga Muni Das"
              />
            </FieldRow>
          )}
        </SectionCard>

        {/* ── Contact ── */}
        <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-3">CONTACT</p>
        <SectionCard>
          <FieldRow>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
            </svg>
            <TextInput
              value={profile.whatsapp}
              onChange={(v) => save({ whatsapp: v, whatsappVerified: false })}
              placeholder="WhatsApp number"
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
              value={profile.email}
              onChange={(v) => save({ email: v, emailVerified: false })}
              placeholder="Email address"
              type="email"
            />
            <VerifyBadge
              verified={profile.emailVerified}
              onVerify={() => {
                if (profile.email.includes("@"))
                  save({ emailVerified: true });
              }}
            />
          </FieldRow>
        </SectionCard>

        {/* ── Location ── */}
        <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-3">LOCATION</p>
        <SectionCard>
          <FieldRow>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f97316" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.083 3.938-5.093 3.938-9.327A8.25 8.25 0 003 12c0 4.234 1.994 7.244 3.937 9.327a19.58 19.58 0 002.683 2.282 16.974 16.974 0 001.144.742zM12 14.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
            </svg>
            <TextInput
              value={profile.city}
              onChange={(v) => save({ city: v })}
              placeholder="Your city"
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
              {locating ? "Detecting…" : "Auto"}
            </button>
          </FieldRow>
        </SectionCard>

        {/* ── Relationship ── */}
        <p className="text-[11px] font-semibold tracking-widest text-gray-500 pb-2 pt-3">YOUR CONNECTION</p>
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

        {/* Bottom breathing room */}
        <div className="h-6" />
      </div>
    </div>
  );
}
