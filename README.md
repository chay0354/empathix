# Empathix — demo

<div dir="rtl">

## בקצרה (עברית)

דמו של Empathix: מנהל מנהל שיחה קולית של 5–7 דקות עם עובד מדומה, ואחריה מאמן AI נותן משוב בקול ובכתב, דוח להדפסה, תמלול ואתגר לניסיון חוזר. עברית, אנגלית וצרפתית.

**שתי תיקיות:**
- `FRONT` — האתר (Next.js): המסכים, השיחה בדפדפן, הדוח והאזור האישי. רץ על פורט 3000.
- `BACK` — השרת (Express): מחזיק את מפתח OpenAI, בונה את ההנחיות לעובד ולמאמן, ומחזיר משוב וקול. רץ על פורט 4000.

**הרצה:**
1. להתקין Node.js 20 ומעלה.
2. בתיקייה הראשית: `npm run setup`
3. להעתיק `BACK/.env.example` ל-`BACK/.env` ולהכניס `OPENAI_API_KEY` (בלי מפתח זה רץ במצב הדגמה).
4. להעתיק `FRONT/.env.example` ל-`FRONT/.env.local`.
5. `npm run dev` ולפתוח http://localhost:3000

**ל-Cursor:** הקובץ `AGENTS.md` מסביר את כל הקוד, המבנה, ההרצה והכללים, והתיקייה `.cursor/rules` נטענת אוטומטית.

</div>

## Quick start (English)

```bash
npm run setup                          # install root + BACK + FRONT
cp BACK/.env.example BACK/.env         # add OPENAI_API_KEY (empty = mock mode)
cp FRONT/.env.example FRONT/.env.local
npm run dev                            # BACK :4000 + FRONT :3000
```

Open http://localhost:3000 · BACK health: http://localhost:4000/health

| Command (root) | What it does |
| --- | --- |
| `npm run setup` | Installs dependencies in root, BACK and FRONT |
| `npm run dev` | Runs BACK and FRONT together with hot reload |
| `npm run build` | Production build of both |
| `npm start` | Runs both production builds |
| `npm run typecheck` | TypeScript check of both |

Full guide (architecture, file map, env vars, deploy, product rules): **[AGENTS.md](AGENTS.md)**.
Acceptance scenarios: **[docs/TEST_PLAN.md](docs/TEST_PLAN.md)**.
