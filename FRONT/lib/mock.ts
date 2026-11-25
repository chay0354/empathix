import type { Lang } from "./types";

/** Scripted employee lines for MOCK mode (no API key) so the full flow can be reviewed. */
const LINES: Record<Lang, string[]> = {
  he: [
    "אני מניח שרצית לדבר איתי על הבעיה בתקופה האחרונה. אני יודע שהיו קשיים, אבל גם עומס העבודה השתנה מאוד.",
    "תראה, אני משתדל. פשוט נראה לי שאף אחד לא שם לב כמה דברים נחתו עליי בחודשים האחרונים.",
    "האמת? אני לא תמיד בטוח מה הכי דחוף. כל יום מגיעה בקשה חדשה ואני מנסה לסגור הכול.",
    "אוקיי. אם נגדיר מה בעדיפות ראשונה, אני חושב שאוכל לעמוד בזה.",
    "בסדר, נעשה ככה. תודה שהקשבת. נדבר שוב בעוד שבוע?"
  ],
  en: [
    "I guess you wanted to talk about the issues lately. I know there have been problems, but the workload has changed a lot too.",
    "Look, I'm trying. It just feels like nobody noticed how much landed on me these past months.",
    "Honestly? I'm not always sure what's most urgent. Every day there's a new request and I try to close everything.",
    "Okay. If we agree on what comes first, I think I can deliver.",
    "Alright, let's do that. Thanks for listening. Shall we check in again next week?"
  ],
  fr: [
    "Je suppose que vous vouliez parler des difficultés de ces derniers temps. Je sais qu'il y a eu des soucis, mais la charge de travail a aussi beaucoup changé.",
    "Écoutez, je fais des efforts. J'ai juste l'impression que personne n'a vu tout ce qui m'est tombé dessus ces derniers mois.",
    "Honnêtement ? Je ne sais pas toujours ce qui est le plus urgent. Chaque jour il y a une nouvelle demande et j'essaie de tout boucler.",
    "D'accord. Si on se met d'accord sur les priorités, je pense pouvoir y arriver.",
    "Très bien, faisons comme ça. Merci de m'avoir écouté. On refait le point la semaine prochaine ?"
  ]
};

export function mockEmployeeLine(lang: Lang, index: number): { text: string; last: boolean } {
  const lines = LINES[lang];
  const i = Math.min(index, lines.length - 1);
  return { text: lines[i], last: i === lines.length - 1 };
}
