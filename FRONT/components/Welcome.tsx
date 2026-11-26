"use client";
import { useState } from "react";
import { useLang } from "./LangProvider";
import { Info, Play } from "./icons";

export function Welcome({ onStart }: { onStart: () => void }) {
  const { t } = useLang();
  const [how, setHow] = useState(false);
  return (
    <div className="ex-center">
      <section className="ex-panel ex-welcome" style={{ background: "var(--cream-50)" }}>
        <h1 className="ex-display">{t("welcomeTitle")}</h1>
        <p className="ex-lead">{t("welcomeSubtitle")}</p>
        <div style={{ marginTop: 40 }}>
          <button className="ex-btn ex-btn--primary ex-welcome__start" onClick={onStart} autoFocus>
            <Play />{t("start")}
          </button>
        </div>
        <div style={{ marginTop: 20 }}>
          <button className="ex-link" aria-expanded={how} onClick={() => setHow((v) => !v)}><Info />{t("howItWorks")}</button>
        </div>
        {how && (
          <ol className="ex-how">
            <li>{t("how1")}</li>
            <li>{t("how2")}</li>
            <li>{t("how3")}</li>
          </ol>
        )}
      </section>
    </div>
  );
}
