"use client";

import { useLanguage } from "@/context/LanguageContext";
import { translations, TranslationKey } from "@/lib/translations";

export function useT() {
  const { lang } = useLanguage();
  return (key: TranslationKey): string =>
    translations[lang][key] ?? translations["en"][key] ?? key;
}
