"use client";
import { MAX_CUSTOM_CHARS, NAMES } from "@/lib/scenarios";
import type { EmployeeId, Setup, SituationId } from "@/lib/types";
import type { TKey } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import { TileFace } from "./Avatar";
import { Arrow, Pencil } from "./icons";

const EMP: EmployeeId[] = ["experienced", "new", "challenging"];
const SIT: SituationId[] = ["performance", "workload", "conflict"];

function CustomText({ label, ph, value, onChange, id }: { label: string; ph: string; value: string; onChange: (v: string) => void; id: string }) {
  const { t } = useLang();
  return (
    <label className="ex-field" htmlFor={id} style={{ marginTop: 16 }}>
      <span className="ex-field__label">{label}</span>
      <input id={id} className="ex-field__input" placeholder={ph} value={value} maxLength={MAX_CUSTOM_CHARS} onChange={(e) => onChange(e.target.value)} autoFocus />
      <span className="ex-field__meta"><span>{t("optional")}</span><span dir="ltr">{value.length}/{MAX_CUSTOM_CHARS}</span></span>
    </label>
  );
}

export function SetupScreen({ setup, onChange, onContinue }: { setup: Setup; onChange: (s: Setup) => void; onContinue: () => void }) {
  const { t } = useLang();
  const set = (p: Partial<Setup>) => onChange({ ...setup, ...p });
  return (
    <section className="ex-panel ex-setup">
      <h1 className="ex-title" style={{ textAlign: "center" }}>{t("setupTitle")}</h1>
      <div className="ex-setup__cols">
        <div>
          <h2 className="ex-section">{t("chooseEmployee")}</h2>
          <div className="ex-tiles" role="radiogroup" aria-label={t("chooseEmployee")}>
            {EMP.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={setup.employee === id}
                className={`ex-tile${setup.employee === id ? " is-selected" : ""}`} onClick={() => set({ employee: id })}>
                <span className="ex-tile__portrait"><TileFace id={id} name={NAMES[id][setup.lang]} /></span>
                <span className="ex-tile__label">{t(`emp_${id}` as TKey)}</span>
                <span className="ex-radio" />
              </button>
            ))}
            <button type="button" role="radio" aria-checked={setup.employee === "custom"}
              className={`ex-tile ex-tile--custom${setup.employee === "custom" ? " is-selected" : ""}`} onClick={() => set({ employee: "custom" })}>
              <span className="ex-tile__portrait"><Pencil width={28} height={28} /></span>
              <span className="ex-tile__label">{t("emp_custom")}</span>
              <span className="ex-radio" />
            </button>
          </div>
          {setup.employee === "custom" && (
            <CustomText id="emp-text" label={t("employeeTextLabel")} ph={t("employeeTextPh")} value={setup.employeeText} onChange={(v) => set({ employeeText: v })} />
          )}
        </div>
        <div>
          <h2 className="ex-section">{t("chooseSituation")}</h2>
          <div className="ex-options" role="radiogroup" aria-label={t("chooseSituation")}>
            {SIT.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={setup.situation === id}
                className={`ex-option${setup.situation === id ? " is-selected" : ""}`} onClick={() => set({ situation: id })}>
                <span className="ex-radio" />{t(`sit_${id}` as TKey)}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={setup.situation === "custom"}
              className={`ex-option${setup.situation === "custom" ? " is-selected" : ""}`} onClick={() => set({ situation: "custom" })}>
              <Pencil />{t("sit_custom")}
            </button>
          </div>
          {setup.situation === "custom" && (
            <CustomText id="sit-text" label={t("situationTextLabel")} ph={t("situationTextPh")} value={setup.situationText} onChange={(v) => set({ situationText: v })} />
          )}
        </div>
      </div>
      <div className="ex-setup__foot">
        <button className="ex-btn ex-btn--primary" onClick={onContinue}>{t("continue")}<Arrow /></button>
      </div>
    </section>
  );
}
