"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dirOf, tr, type TKey } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string; dir: "rtl" | "ltr" }
const LangCtx = createContext<Ctx | null>(null);
const KEY = "empathix.lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("he");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved === "he" || saved === "en" || saved === "fr") setLangState(saved);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: tr(lang), dir: dirOf(lang) }), [lang, setLang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const c = useContext(LangCtx);
  if (!c) throw new Error("useLang outside LangProvider");
  return c;
}
