"use client";
import Link from "next/link";
import { LANGS } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import { User } from "./icons";
import { Logo } from "./Logo";

export function TopBar({ showLangs = false, showArea = true, center }: { showLangs?: boolean; showArea?: boolean; center?: React.ReactNode }) {
  const { lang, setLang, t } = useLang();
  return (
    <header className="ex-top">
      <Link href="/" aria-label="Empathix" style={{ textDecoration: "none" }}>
        <Logo />
      </Link>
      {center}
      <div className="ex-top__tools">
        {showArea && (
          <Link className="ex-link" href="/area"><User />{t("myArea")}</Link>
        )}
        {showLangs && (
          <div className="ex-langs" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l.id} lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
