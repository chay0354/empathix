import type { EmployeeId, VoiceId } from "./types";
import { EMPLOYEES } from "./scenarios";

/** Voices that fit a face: three male, three female. The first of each is the default. */
export const VOICES: { id: VoiceId; gender: "m" | "f" }[] = [
  { id: "cedar", gender: "m" },
  { id: "verse", gender: "m" },
  { id: "ash", gender: "m" },
  { id: "marin", gender: "f" },
  { id: "coral", gender: "f" },
  { id: "sage", gender: "f" }
];

const DEFAULTS: Record<EmployeeId, VoiceId> = {
  experienced: "cedar",
  new: "marin",
  challenging: "verse",
  custom: "cedar"
};

export function voicesFor(employee: EmployeeId) {
  if (employee === "custom") return VOICES;
  const gender = EMPLOYEES[employee].gender;
  return VOICES.filter((v) => v.gender === gender);
}

/** Keep the current voice when it still fits the face, otherwise use that employee's default. */
export function voiceFor(employee: EmployeeId, current?: VoiceId): VoiceId {
  const options = voicesFor(employee);
  if (current && options.some((v) => v.id === current)) return current;
  return DEFAULTS[employee];
}
