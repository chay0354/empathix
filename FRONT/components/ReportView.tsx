"use client";
import { DICTS } from "@/lib/i18n";
import { employeeOf, situationTitle } from "@/lib/scenarios";
import type { SessionRecord } from "@/lib/types";
import { Printer } from "./icons";
import { Logo } from "./Logo";

const LOCALE = { he: "he-IL", en: "en-GB", fr: "fr-FR" } as const;

/** Printable report in the language of the simulation (not the UI language). */
export function ReportView({ rec, onClose }: { rec: SessionRecord; onClose: () => void }) {
  const L = rec.setup.lang;
  const t = (k: keyof (typeof DICTS)["he"]) => DICTS[L][k];
  const fb = rec.feedback;
  const q = (s: string) => (L === "he" ? `״${s}״` : L === "fr" ? `« ${s} »` : `“${s}”`);
  const quotes = [fb?.worked.quote, fb?.improve.quote].filter(Boolean) as string[];
  const date = new Date(rec.createdAt).toLocaleString(LOCALE[L], { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <div className="ex-doc__actions ex-noprint">
        <button className="ex-btn ex-btn--secondary" onClick={onClose}>{t("close")}</button>
        <button className="ex-btn ex-btn--primary" onClick={() => window.print()}><Printer />{t("print")}</button>
      </div>
      <article className="ex-panel ex-doc" lang={L} dir={L === "he" ? "rtl" : "ltr"}>
        <header className="ex-doc__head">
          <div>
            <Logo height={30} />
            <h1 className="ex-title" style={{ marginTop: 16 }}>{t("reportTitle")}</h1>
            <p className="ex-body ex-muted">{situationTitle(rec.setup, (k) => t(k as keyof (typeof DICTS)["he"]))} · <span dir="auto">{employeeOf(rec.setup).name}</span></p>
          </div>
          <div className="ex-doc__meta">
            <div>{t("date")}: {date}</div>
            <div>{t("duration")}: {Math.max(1, Math.round(rec.durationSec / 60))} {t("minutes")}</div>
            <div>{t("attempt")}: {rec.attempt}</div>
          </div>
        </header>
        {!fb ? (
          <section><p className="ex-body">{t("errCoach")}</p></section>
        ) : (
          <>
            <section><h2>{t("reportSummary")}</h2><p className="ex-body">{fb.summary}</p>{fb.limited && <p className="ex-note">{t("limitedNote")}</p>}</section>
            <section><h2>{t("reportWorked")}</h2><p className="ex-body"><b>{fb.worked.headline}.</b> {fb.worked.detail}</p></section>
            <section><h2>{t("reportImprove")}</h2><p className="ex-body"><b>{fb.improve.headline}.</b> {fb.improve.detail}</p></section>
            {quotes.length > 0 && (
              <section><h2>{t("reportQuotes")}</h2>{quotes.map((x) => <blockquote key={x} dir="auto">{q(x)}</blockquote>)}</section>
            )}
            <section><h2>{t("reportAlternative")}</h2><blockquote dir="auto">{q(fb.alternative.phrase)}</blockquote><p className="ex-note">{fb.alternative.why}</p></section>
            <section><h2>{t("reportChallenge")}</h2><p className="ex-body">{fb.challenge}</p></section>
            <section><h2>{t("reportOutcome")}</h2><p className="ex-body">{fb.outcome ?? t("reportNoOutcome")}</p></section>
            {fb.comparison && <section><h2>{t("reportComparison")}</h2><p className="ex-body">{fb.comparison}</p></section>}
          </>
        )}
      </article>
    </>
  );
}

export function TranscriptView({ rec, onClose }: { rec: SessionRecord; onClose: () => void }) {
  const L = rec.setup.lang;
  const t = (k: keyof (typeof DICTS)["he"]) => DICTS[L][k];
  const name = employeeOf(rec.setup).name;
  const mmss = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  return (
    <>
      <div className="ex-doc__actions ex-noprint">
        <button className="ex-btn ex-btn--secondary" onClick={onClose}>{t("close")}</button>
        <button className="ex-btn ex-btn--primary" onClick={() => window.print()}><Printer />{t("print")}</button>
      </div>
      <article className="ex-panel ex-doc" lang={L} dir={L === "he" ? "rtl" : "ltr"}>
        <header className="ex-doc__head"><h1 className="ex-title">{t("transcript")}</h1></header>
        <div style={{ marginTop: 16 }}>
          {rec.transcript.map((x) => (
            <div className="ex-turn" key={x.id}>
              <div>
                <div className={`ex-turn__who${x.role === "manager" ? " is-manager" : ""}`}>{x.role === "manager" ? t("you") : name}</div>
                <div className="ex-turn__time">{mmss(x.t)}</div>
              </div>
              <p className="ex-body" dir="auto">{x.text}</p>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}
