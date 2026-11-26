"use client";
import { briefText, employeeOf } from "@/lib/scenarios";
import type { Setup } from "@/lib/types";
import { useLang } from "./LangProvider";
import { Play } from "./icons";

export function Brief({ setup, challenge, record, setRecord, mock, onBack, onStart }: {
  setup: Setup; challenge: string | null; record: boolean; setRecord: (v: boolean) => void; mock: boolean; onBack: () => void; onStart: () => void;
}) {
  const { t } = useLang();
  const name = employeeOf(setup).name;
  return (
    <section className="ex-panel ex-brief">
      <h1 className="ex-title">{t("briefTitle")}</h1>
      <div>
        <h3>{t("briefSituation")} · <span dir="auto">{name}</span></h3>
        <p className="ex-body">{briefText(setup)}</p>
      </div>
      <div>
        <h3>{t("briefGoal")}</h3>
        <p className="ex-body">{t("briefGoalText")}</p>
      </div>
      {challenge && (
        <div className="ex-challenge">
          <h3>{t("yourChallenge")}</h3>
          <p className="ex-body">{challenge}</p>
        </div>
      )}
      <p className="ex-body ex-muted">{t("briefYouOpen")}</p>
      {!mock && (
        <div className="ex-consent">
          <h3>{t("recordingTitle")}</h3>
          <p className="ex-body ex-muted" style={{ fontSize: 15, lineHeight: "22px" }}>{t("recordingText")}</p>
          <label className="ex-check"><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} />{t("recordingToggle")}</label>
        </div>
      )}
      <div className="ex-brief__actions">
        <button className="ex-link" onClick={onBack}>{t("back")}</button>
        <button className="ex-btn ex-btn--primary" onClick={onStart} autoFocus><Play />{t("startCall")}</button>
      </div>
    </section>
  );
}
