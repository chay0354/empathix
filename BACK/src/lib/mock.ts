import { employeeOf } from "./scenarios";
import type { Feedback, Lang, Setup, Turn } from "./types";

/** Sample feedback for MOCK mode (no OPENAI_API_KEY) so the UI can be reviewed without cost. */
const T: Record<Lang, Omit<Feedback, "worked" | "improve" | "limited"> & { w: [string, string]; i: [string, string] }> = {
  he: {
    summary: "מצב הדגמה: זהו משוב לדוגמה שמראה את המבנה. במצב אמיתי המאמן מנתח את התמליל המלא של השיחה שלך.",
    w: ["פתחת את השיחה בטון מכבד", "נתת לעובד מקום להסביר את נקודת המבט שלו לפני שעברת לפתרונות."],
    i: ["אפשר לדייק את הציפיות", "כדאי להגדיר במפורש מה צריך לקרות ועד מתי, כדי שהשיחה תסתיים בצעד ברור."],
    alternative: { phrase: "אני רוצה להבין מה השתנה ומה מקשה עליך, ובמקביל למצוא יחד דרך לעמוד בציפיות.", why: "המשפט מחבר בין הקשבה לבין אחריות, בלי להאשים." },
    challenge: "בניסיון הבא, שאלו לפחות שתי שאלות פתוחות לפני שאתם מציגים את הציפיות.",
    outcome: null,
    comparison: null,
    spoken: "זהו משוב לדוגמה במצב הדגמה. פתחת את השיחה בטון מכבד ונתת לעובד מקום להסביר. בפעם הבאה, נסו להגדיר במפורש מה צריך לקרות ועד מתי."
  },
  en: {
    summary: "Demo mode: this is sample feedback that shows the structure. With a real key the coach analyses your full transcript.",
    w: ["You opened with a respectful tone", "You gave the employee room to explain their view before moving to solutions."],
    i: ["Make expectations explicit", "Say clearly what needs to happen and by when, so the conversation ends with a concrete step."],
    alternative: { phrase: "I want to understand what changed and what's making this hard, and at the same time find a way we can meet expectations.", why: "It links listening with accountability, without blame." },
    challenge: "Next time, ask at least two open questions before you state your expectations.",
    outcome: null,
    comparison: null,
    spoken: "This is sample feedback in demo mode. You opened respectfully and gave the employee room to explain. Next time, try to say clearly what needs to happen and by when."
  },
  fr: {
    summary: "Mode démo : ceci est un feedback d'exemple qui montre la structure. Avec une vraie clé, le coach analyse toute votre transcription.",
    w: ["Vous avez ouvert sur un ton respectueux", "Vous avez laissé le collaborateur expliquer son point de vue avant de passer aux solutions."],
    i: ["Clarifier les attentes", "Dites clairement ce qui doit se passer et pour quand, afin que la conversation se termine sur une étape concrète."],
    alternative: { phrase: "Je veux comprendre ce qui a changé et ce qui vous met en difficulté, et en même temps trouver comment répondre aux attentes.", why: "La phrase relie écoute et responsabilité, sans reproche." },
    challenge: "La prochaine fois, posez au moins deux questions ouvertes avant d'énoncer vos attentes.",
    outcome: null,
    comparison: null,
    spoken: "Ceci est un feedback d'exemple en mode démo. Vous avez ouvert avec respect et laissé votre collaborateur s'exprimer. La prochaine fois, dites clairement ce qui doit se passer et pour quand."
  }
};

export function mockFeedback(setup: Setup, turns: Turn[], _endedBy: string, retry: boolean): Feedback {
  const t = T[setup.lang];
  const firstManager = turns.find((x) => x.role === "manager" && x.text.trim())?.text.trim() ?? null;
  const name = employeeOf(setup).name;
  return {
    summary: t.summary,
    worked: { headline: t.w[0], detail: t.w[1], quote: firstManager },
    improve: { headline: t.i[0], detail: t.i[1], quote: null },
    alternative: t.alternative,
    challenge: t.challenge,
    outcome: null,
    limited: turns.filter((x) => x.role === "manager").length < 4,
    comparison: retry
      ? setup.lang === "he"
        ? `לעומת הניסיון הקודם, ${name} נפתח מוקדם יותר בשיחה.`
        : setup.lang === "fr"
          ? `Par rapport à l'essai précédent, ${name} s'est ouvert plus tôt.`
          : `Compared with your previous attempt, ${name} opened up earlier.`
      : null,
    spoken: t.spoken
  };
}
