"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteSession, getRecording, listSessions } from "@/lib/storage";
import { employeeOf, situationTitle } from "@/lib/scenarios";
import type { SessionRecord } from "@/lib/types";
import type { TKey } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import { TopBar } from "./TopBar";
import { ReportView, TranscriptView } from "./ReportView";
import { Doc, Headphones, Lines, Play } from "./icons";

export function PersonalArea() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<SessionRecord[]>([]);
  const [view, setView] = useState<{ rec: SessionRecord; kind: "report" | "transcript" } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => setItems(listSessions()), []);

  const play = async (id: string) => {
    const b = await getRecording(id);
    if (b) setAudio({ id, url: URL.createObjectURL(b) });
  };
  const remove = async (id: string) => {
    await deleteSession(id);
    setItems(listSessions());
    setConfirm(null);
    if (audio?.id === id) setAudio(null);
  };
  const locale = lang === "he" ? "he-IL" : lang === "fr" ? "fr-FR" : "en-GB";

  return (
    <main className="ex-page">
      <TopBar showArea={false} />
      {view ? (
        view.kind === "report" ? <ReportView rec={view.rec} onClose={() => setView(null)} /> : <TranscriptView rec={view.rec} onClose={() => setView(null)} />
      ) : (
        <section className="ex-panel ex-area">
          <div className="ex-area__head">
            <h1 className="ex-title">{t("areaTitle")}</h1>
            <Link className="ex-btn ex-btn--primary" href="/"><Play />{t("newPractice")}</Link>
          </div>
          <p className="ex-note">{t("areaPrivacy")}</p>
          {items.length === 0 ? (
            <p className="ex-body ex-muted" style={{ marginTop: 32 }}>{t("areaEmpty")}</p>
          ) : (
            <ul className="ex-list">
              {items.map((s) => (
                <li className="ex-item" key={s.id}>
                  <div>
                    <p className="ex-item__title">{situationTitle(s.setup, (k) => t(k as TKey))} · <span dir="auto">{employeeOf(s.setup).name}</span></p>
                    <p className="ex-item__meta">
                      {new Date(s.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })} · {Math.max(1, Math.round(s.durationSec / 60))} {t("minutes")} · {t("attempt")} {s.attempt}
                    </p>
                  </div>
                  <div className="ex-item__actions">
                    {confirm === s.id ? (
                      <>
                        <span className="ex-item__meta" style={{ margin: 0 }}>{t("confirmDelete")}</span>
                        <button className="ex-link ex-link--danger" onClick={() => void remove(s.id)}>{t("yesDelete")}</button>
                        <button className="ex-link" onClick={() => setConfirm(null)}>{t("cancel")}</button>
                      </>
                    ) : (
                      <>
                        {s.feedback && <button className="ex-link" onClick={() => setView({ rec: s, kind: "report" })}><Doc />{t("fullReport")}</button>}
                        <button className="ex-link" onClick={() => setView({ rec: s, kind: "transcript" })}><Lines />{t("transcript")}</button>
                        {s.hasRecording && <button className="ex-link" onClick={() => void play(s.id)}><Headphones />{t("replay")}</button>}
                        <button className="ex-link ex-link--danger" onClick={() => setConfirm(s.id)}>{t("delete")}</button>
                      </>
                    )}
                  </div>
                  {audio?.id === s.id && <audio src={audio.url} controls autoPlay />}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
