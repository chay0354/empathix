/** UI-side scenario data: names and the brief shown before the call. Prompts live in BACK/src/lib. */
import type { EmployeeId, Lang, Setup, SituationId } from "./types";

export interface EmployeePreset {
  id: EmployeeId;
  name: string;
  gender: "m" | "f";
}

export const EMPLOYEES: Record<EmployeeId, EmployeePreset> = {
  experienced: {
    id: "experienced",
    name: "Julien",
    gender: "m",
  },
  new: {
    id: "new",
    name: "Maya",
    gender: "f",
  },
  challenging: {
    id: "challenging",
    name: "David",
    gender: "m",
  },
  custom: {
    id: "custom",
    name: "Alex",
    gender: "m",
  }
};

export const SITUATIONS: Record<Exclude<SituationId, "custom">, { brief: Record<Lang, (name: string) => string> }> = {
  performance: {
    brief: {
      he: (n) => `בשבועות האחרונים ניכרת ירידה בביצועים של ${n}: עמידה בלוחות זמנים ואיכות העבודה. ביקשת שיחה אישית כדי לדבר על זה.`,
      en: (n) => `Over recent weeks ${n}'s performance has dropped: missed deadlines and lower quality. You asked for a one-to-one to talk about it.`,
      fr: (n) => `Ces dernières semaines, la performance de ${n} a baissé : délais non tenus et qualité en recul. Vous avez demandé un entretien individuel pour en parler.`
    }
  },
  workload: {
    brief: {
      he: (n) => `${n} נראה עמוס ושחוק: נשאר עד מאוחר, מתוח בישיבות, וכמה משימות נשמטו. אתם צריכים שהעבודה תימשך, ובמקביל חוששים משחיקה.`,
      en: (n) => `${n} seems overloaded and worn out: staying late, tense in meetings, and a few tasks have slipped. You need work to keep moving, and you're worried about burnout.`,
      fr: (n) => `${n} semble surchargé·e et épuisé·e : reste tard, tendu·e en réunion, et quelques tâches ont glissé. Le travail doit avancer, mais vous craignez l'épuisement.`
    }
  },
  conflict: {
    brief: {
      he: (n) => `יש חיכוך מתמשך בין ${n} לבין עמית בצוות. שיתוף הפעולה נפגע, וחברי צוות אחרים כבר התלוננו. אתם צריכים שהם יחזרו לעבוד יחד.`,
      en: (n) => `There's ongoing friction between ${n} and a teammate. Collaboration has broken down and others have complained. You need them working together again.`,
      fr: (n) => `Il y a des tensions persistantes entre ${n} et un collègue. La collaboration s'est dégradée et d'autres membres de l'équipe se sont plaints. Vous avez besoin qu'ils retravaillent ensemble.`
    }
  }
};

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

export function briefText(setup: Setup): string {
  const name = employeeOf(setup).name;
  if (setup.situation === "custom") {
    return setup.situationText.trim() || SITUATIONS.performance.brief[setup.lang](name);
  }
  return SITUATIONS[setup.situation].brief[setup.lang](name);
}

/** Short, user-facing title for the call bar. */
export function situationTitle(setup: Setup, label: (k: string) => string): string {
  if (setup.situation === "custom") return setup.situationText.trim().slice(0, 48) || label("sit_custom");
  return label(`sit_${setup.situation}`);
}

export const MAX_CUSTOM_CHARS = 120;
