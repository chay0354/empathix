export type Lang = "he" | "en" | "fr";
export type EmployeeId = "experienced" | "new" | "challenging" | "custom";
export type SituationId = "performance" | "workload" | "conflict" | "custom";
export type VoiceId = "cedar" | "verse" | "ash" | "marin" | "coral" | "sage";

export interface Setup {
  lang: Lang;
  employee: EmployeeId;
  employeeText: string;
  situation: SituationId;
  situationText: string;
  voice: VoiceId;
}

export interface Turn {
  id: string;
  role: "manager" | "employee";
  text: string;
  /** ms since the call started */
  t: number;
  typed?: boolean;
}

export interface FeedbackPoint {
  headline: string;
  detail: string;
  /** Exact words from the transcript, verified server-side; null when none. */
  quote: string | null;
}

export interface Feedback {
  summary: string;
  worked: FeedbackPoint;
  improve: FeedbackPoint;
  alternative: { phrase: string; why: string };
  challenge: string;
  outcome: string | null;
  limited: boolean;
  comparison: string | null;
  spoken: string;
}

export type EndedBy = "manager" | "employee" | "time";

export interface SessionRecord {
  id: string;
  createdAt: string;
  setup: Setup;
  transcript: Turn[];
  durationSec: number;
  endedBy: EndedBy;
  feedback: Feedback | null;
  attempt: number;
  parentId: string | null;
  /** The challenge shown for this attempt (retry only). */
  challenge: string | null;
  hasRecording: boolean;
  mock: boolean;
}
