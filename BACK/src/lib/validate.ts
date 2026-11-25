import type { Feedback, Lang, Setup, Turn } from "./types";
import { parseVoice } from "./voices";

const LANGS: Lang[] = ["he", "en", "fr"];
const EMP = ["experienced", "new", "challenging", "custom"];
const SIT = ["performance", "workload", "conflict", "custom"];

/** Validate and clamp a Setup coming from the browser. Returns null if invalid. */
export function parseSetup(x: unknown): Setup | null {
  if (!x || typeof x !== "object") return null;
  const s = x as Record<string, unknown>;
  if (!LANGS.includes(s.lang as Lang) || !EMP.includes(s.employee as string) || !SIT.includes(s.situation as string)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 160) : "");
  return {
    lang: s.lang as Lang,
    employee: s.employee as Setup["employee"],
    situation: s.situation as Setup["situation"],
    employeeText: str(s.employeeText),
    situationText: str(s.situationText),
    voice: parseVoice(s.voice, s.employee as Setup["employee"])
  };
}

/** Validate a transcript array coming from the browser. */
export function parseTurns(x: unknown): Turn[] {
  if (!Array.isArray(x)) return [];
  return x
    .slice(0, 400)
    .filter((t) => t && (t.role === "manager" || t.role === "employee") && typeof t.text === "string")
    .map((t, i) => ({ id: String(t.id ?? i), role: t.role, text: String(t.text).slice(0, 2000), t: Number(t.t) || 0 }));
}

export function parseFeedback(x: unknown): Feedback | null {
  return x && typeof x === "object" && "challenge" in x && "improve" in x ? (x as Feedback) : null;
}
