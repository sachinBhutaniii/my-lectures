"use client";

import { useState } from "react";
import apiClient from "@/services/api";

interface ConfigEntry {
  key: string;
  label: string;
  hint?: string;
  sensitive?: boolean;
}

const CONFIG_KEYS: ConfigEntry[] = [
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API Key",
    hint: "Get from aistudio.google.com → API keys",
    sensitive: true,
  },
];

export default function AdminSettingsPanel() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = async (entry: ConfigEntry) => {
    const value = values[entry.key]?.trim();
    if (!value) {
      setErrors((e) => ({ ...e, [entry.key]: "Value cannot be empty" }));
      return;
    }
    setSaving((s) => ({ ...s, [entry.key]: true }));
    setErrors((e) => ({ ...e, [entry.key]: "" }));
    try {
      await apiClient.put(`/api/admin/config/${entry.key}`, { value });
      setSaved((s) => ({ ...s, [entry.key]: true }));
      setValues((v) => ({ ...v, [entry.key]: "" }));
      setTimeout(() => setSaved((s) => ({ ...s, [entry.key]: false })), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setErrors((e) => ({ ...e, [entry.key]: msg }));
    } finally {
      setSaving((s) => ({ ...s, [entry.key]: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-white font-semibold text-base">API Keys & Config</h2>
        <p className="text-gray-500 text-xs mt-0.5">Updates take effect immediately — no redeploy needed.</p>
      </div>

      {CONFIG_KEYS.map((entry) => (
        <div key={entry.key} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-200">{entry.label}</p>
            {entry.hint && <p className="text-xs text-gray-500 mt-0.5">{entry.hint}</p>}
          </div>

          <input
            type={entry.sensitive ? "password" : "text"}
            placeholder={`Paste new ${entry.label}…`}
            value={values[entry.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [entry.key]: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 font-mono"
          />

          {errors[entry.key] && (
            <p className="text-xs text-red-400">{errors[entry.key]}</p>
          )}

          <button
            onClick={() => handleSave(entry)}
            disabled={saving[entry.key] || !values[entry.key]?.trim()}
            className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {saving[entry.key] ? "Saving…" : saved[entry.key] ? "Saved ✓" : "Save"}
          </button>
        </div>
      ))}
    </div>
  );
}
