import type { EmployeeId, VoiceId } from "./types";

const ALLOWED: VoiceId[] = ["cedar", "verse", "ash", "marin", "coral", "sage"];

const DEFAULTS: Record<EmployeeId, VoiceId> = {
  experienced: "cedar",
  new: "marin",
  challenging: "verse",
  custom: "cedar"
};

export function parseVoice(value: unknown, employee: EmployeeId): VoiceId {
  return ALLOWED.includes(value as VoiceId) ? (value as VoiceId) : DEFAULTS[employee];
}
