/** Server-side scenario data: employee profiles, voices and the internal situation the model plays. */
import type { EmployeeId, Lang, Setup, SituationId } from "./types";

export interface EmployeePreset {
  id: EmployeeId;
  name: string;
  gender: "m" | "f";
  voice: string;
  /** Internal profile for the employee model (not shown to the user). */
  profile: string;
}

export const EMPLOYEES: Record<EmployeeId, EmployeePreset> = {
  experienced: {
    id: "experienced",
    name: "Julien",
    gender: "m",
    voice: "cedar",
    profile:
      "Experienced, skilled professional (about 8 years in the team) who used to perform very well. Recently there has been a professional problem. Medium difficulty: not aggressive or fully closed, but does not share everything at once. Wants his efforts and point of view to be seen, while knowing he has not met expectations lately."
  },
  new: {
    id: "new",
    name: "Maya",
    gender: "f",
    voice: "marin",
    profile:
      "Joined the team about four months ago. Motivated but unsure of what is expected; afraid of looking incompetent so she tends to hide difficulties. Polite, slightly anxious, gives short answers at first and opens up only when she feels safe."
  },
  challenging: {
    id: "challenging",
    name: "David",
    gender: "m",
    voice: "verse",
    profile:
      "Capable, outspoken team member with a strong opinion of his own work. Quick to push back, can deflect responsibility to others or to processes, and reacts sharply to anything that sounds like blame. Underneath, feels his contribution is not recognised. Never abusive, but the hardest of the three to move."
  },
  custom: {
    id: "custom",
    name: "Alex",
    gender: "m",
    voice: "cedar",
    profile: "A professional colleague. Build the personality from the manager's short description."
  }
};

export const SITUATIONS: Record<Exclude<SituationId, "custom">, { internal: string }> = {
  performance: {
    internal:
      "Performance has dropped over recent weeks (missed deadlines, lower quality). The manager asked for this one-to-one to address it."
  },
  workload: {
    internal:
      "The employee seems overloaded and worn out: working late, irritable in meetings, a few tasks slipped. The manager needs delivery to continue but is worried about burnout."
  },
  conflict: {
    internal:
      "There is ongoing friction between the employee and a teammate; collaboration has broken down and others in the team have complained. The manager needs them to work together again."
  }
};

export const LANG_NAME: Record<Lang, string> = { he: "Hebrew", en: "English", fr: "French" };

/** Employee names as they read in each language (the call voice says them the same way). */
export const NAMES: Record<EmployeeId, Record<Lang, string>> = {
  experienced: { he: "ז׳וליאן", en: "Julien", fr: "Julien" },
  new: { he: "מאיה", en: "Maya", fr: "Maya" },
  challenging: { he: "דוד", en: "David", fr: "David" },
  custom: { he: "אלכס", en: "Alex", fr: "Alex" }
};

export function employeeOf(setup: Pick<Setup, "employee" | "lang">) {
  return { ...EMPLOYEES[setup.employee], name: NAMES[setup.employee][setup.lang] };
}



