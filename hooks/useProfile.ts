"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "bdd_user_profile";

export type Relationship =
  | "diksha"
  | "shiksha"
  | "aspiring"
  | "seeker"
  | "";

export interface UserProfile {
  legalName: string;
  isInitiated: boolean;
  initiatedName: string;
  whatsapp: string;
  whatsappVerified: boolean;
  email: string;
  emailVerified: boolean;
  city: string;
  relationship: Relationship;
  profilePicture: string; // base64 data URL or ""
}

const DEFAULT_PROFILE: UserProfile = {
  legalName: "",
  isInitiated: false,
  initiatedName: "",
  whatsapp: "",
  whatsappVerified: false,
  email: "",
  emailVerified: false,
  city: "",
  relationship: "",
  profilePicture: "",
};

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Display name: prefer initiatedName if initiated, else legalName, else "Guest"
  const displayName =
    (profile.isInitiated && profile.initiatedName.trim())
      ? profile.initiatedName.trim()
      : profile.legalName.trim() || "Guest";

  return { profile, updateProfile, loaded, displayName };
}
