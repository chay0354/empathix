# AGENTS.md — Empathix (read this first)

Guide for Cursor / AI coding agents and developers. It explains what the product does, how the code is organised, how to run it, and the rules to keep when changing it.

## 1. What the product is

Empathix is an AI coaching demo for managers. The manager:

1. Picks an **employee** (experienced / new / challenging / custom) and a **situation** (performance / workload / conflict / custom).
2. Reads a short **brief** and holds a 5–7 minute **voice conversation** with a simulated employee (can also type). The manager always opens.
3. Gets **feedback from a separate AI coach** — spoken and written: what worked, what to improve (with an exact quote), an alternative phrase, and one challenge.
4. Can open a **printable report**, the **full transcript**, **retry** the same conversation with the challenge, or open the **personal area** (history, replay recording, delete).

Languages: Hebrew (RTL), English, French. The whole session (employee, coach, report) follows the language chosen on the welcome screen.

## 2. Repository layout

```
empathix/
├── AGENTS.md              ← this file
├── README.md              ← quick start (Hebrew + English)
├── package.json           ← root scripts: setup / dev / build / start (runs BACK + FRONT together)
├── .cursor/rules/         ← Cursor project rules (overview, FRONT, BACK)
├── docs/TEST_PLAN.md      ← the 10 acceptance scenarios
├── FRONT/                 ← Next.js 15 + React 19 web app (port 3000)
│   ├── app/               ← routes: / (main flow), /area (personal area), layout, globals.css
│   ├── components/        ← one file per screen/part (see §4)
│   ├── lib/               ← client logic: api, call (WebRTC), i18n, scenarios, storage, types, mock
│   ├── public/            ← logo.png, mark.png, avatars/ (optional portraits)
│   └── middleware.ts      ← optional site password (DEMO_PASSWORD)
└── BACK/                  ← Node 20+ / Express 4 API server (port 4000)
    └── src/
        ├── index.ts       ← server: CORS, JSON, rate limit, mounts routes
        ├── routes/        ← config, session (realtime), coach, tts
        └── lib/           ← env, prompts, scenarios, validate, mock, types
```

## 3. How it works (data flow)

```
FRONT (browser)                               BACK (Express)                       OpenAI
───────────────                               ──────────────                       ──────
GET  /api/config  ───────────────────────────▶ { mock: true|false }
POST /api/realtime/session {setup} ──────────▶ builds employee prompt ──────────────▶ /v1/realtime/client_secrets
                                   ◀────────── { value: <2-min secret>, model }
WebRTC (mic audio + data channel) ─────────────────────────────────────────────────▶ /v1/realtime/calls
   ◀── employee voice + events (transcripts, speaking, end_conversation) ───────────
POST /api/coach {setup, transcript} ─────────▶ coach prompt + JSON schema ─────────▶ /v1/chat/completions
                                   ◀────────── feedback (quotes verified)
POST /api/tts {text, lang} ──────────────────▶ ─────────────────────────────────────▶ /v1/audio/speech
                                   ◀────────── audio/mpeg (coach voice)
localStorage + IndexedDB ◀── reports, transcripts, recordings (never sent to BACK)
```

Key points:
- The **OpenAI API key lives only in BACK**. The browser gets a 2-minute client secret and talks to OpenAI Realtime directly over WebRTC, so call audio does not pass through BACK.
- **Mock mode**: if `OPENAI_API_KEY` is empty, BACK returns `{mock:true}` and FRONT runs a scripted employee (typed turns + browser speech) with sample feedback. Use it to work on UI without cost.
- **Grounding guard** (`BACK/src/lib/prompts.ts → verifyQuote`): any quote the coach returns that does not literally appear in a manager turn is set to `null`. Never remove this.

## 4. Where things are

### FRONT
| File | Role |
| --- | --- |
| `components/App.tsx` | The flow state machine: `welcome → setup → brief → call → preparing → feedback ↔ report / transcript`. Saves sessions, calls the coach, handles retry. |
| `components/Welcome.tsx` | Title, subtitle, start button, "how it works", language switch (in `TopBar`). |
| `components/SetupScreen.tsx` | Employee tiles + situation rows + optional custom text fields. |
| `components/Brief.tsx` | Situation, goal, challenge (on retry), recording notice + opt-out. |
| `components/CallScreen.tsx` | Call UI: timer, avatar, controls (camera, mic, end, keyboard), typing bar, soft close at 6:30, hard stop at 9:00, errors. |
| `components/FeedbackScreen.tsx` | Coach avatar + voice (TTS, falls back to browser speech), 3 feedback rows, actions, links. |
| `components/ReportView.tsx` | `ReportView` (printable report) and `TranscriptView`. Print uses `window.print()` + print CSS. |
| `components/PersonalArea.tsx` | `/area`: list, open report/transcript, replay recording, delete with inline confirm. |
| `components/Avatar.tsx` | Avatar placeholder (pulses with voice). Loads `/avatars/<id>.jpg` if present. |
| `components/LangProvider.tsx` | Language context; sets `<html lang dir>`. |
| `lib/call.ts` | `RealtimeCall` (WebRTC to OpenAI, transcript ordering, recording via MediaRecorder, voice level) and `MockCall`. |
| `lib/api.ts` | `api(path)` → `NEXT_PUBLIC_API_URL + path`. All calls to BACK go through it. |
| `lib/i18n.ts` | **All UI strings** for he / en / fr. Add a key to all three languages. |
| `lib/scenarios.ts` | Employee names per language, situation briefs shown to the user. |
| `lib/storage.ts` | Personal area storage (localStorage for records, IndexedDB for audio). |
| `lib/types.ts` | Shared types (`Setup`, `Turn`, `Feedback`, `SessionRecord`). |
| `app/globals.css` | Design tokens (CSS variables) + all component classes (`ex-*`). |

### BACK
| File | Role |
| --- | --- |
| `src/index.ts` | Express app, CORS (`FRONT_ORIGIN`), rate limit, routes, `/health`. |
| `src/routes/config.ts` | `GET /api/config` → `{ mock }`. |
| `src/routes/session.ts` | `POST /api/realtime/session` → realtime client secret (employee prompt, voice, transcription, `end_conversation` tool). |
| `src/routes/coach.ts` | `POST /api/coach` → structured feedback (JSON schema), quote verification, limited flag. |
| `src/routes/tts.ts` | `POST /api/tts` → coach voice mp3 (404 in mock mode). |
| `src/lib/prompts.ts` | **Employee prompt**, **coach prompt**, feedback JSON schema, `verifyQuote`. Product behaviour lives here. |
| `src/lib/scenarios.ts` | Employee profiles + voices, internal situation descriptions, names. |
| `src/lib/validate.ts` | Validation/clamping of everything coming from the browser. |
| `src/lib/env.ts` | Env config (models, port, origins, rate limit). |
| `src/lib/mock.ts` | Sample feedback for mock mode. |

`lib/types.ts` exists in both FRONT and BACK and **must stay identical**. If you change one, copy it to the other.

## 5. Run locally

Requirements: Node.js 20+ and npm. For the real voice demo: an OpenAI API key with billing.

```bash
# from the repo root
npm run setup                          # installs root, BACK and FRONT
cp BACK/.env.example BACK/.env         # set OPENAI_API_KEY (leave empty for mock mode)
cp FRONT/.env.example FRONT/.env.local # NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev                            # BACK on :4000 + FRONT on :3000
```

Open http://localhost:3000. Check BACK at http://localhost:4000/health.

Run separately if needed: `npm --prefix BACK run dev` and `npm --prefix FRONT run dev`.

Checks before committing: `npm run typecheck` and `npm run build`.

Microphone needs HTTPS or localhost. Chrome is the reference browser.

## 6. Environment variables

**BACK/.env**
| Var | Default | Meaning |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | Empty = mock mode. |
| `PORT` | 4000 | Server port. |
| `FRONT_ORIGIN` | http://localhost:3000 | Comma-separated allowed origins (CORS). Add the deployed FRONT URL. |
| `REALTIME_MODEL` | gpt-realtime | Voice model for the employee. |
| `REALTIME_TRANSCRIBE_MODEL` | gpt-4o-mini-transcribe | Live transcription. |
| `COACH_MODEL` | gpt-4.1 | Coach feedback model (must support JSON schema output). |
| `TTS_MODEL` / `TTS_VOICE` | gpt-4o-mini-tts / marin | Coach voice. |
| `RATE_LIMIT_PER_MIN` | 30 | Requests per IP per minute on `/api/*`. |

**FRONT/.env.local**
| Var | Meaning |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | BACK base URL (e.g. http://localhost:4000 or the deployed BACK URL). |
| `DEMO_PASSWORD` | Optional site-wide password (basic auth). |

## 7. Deploy

- **BACK**: any Node host (Render, Railway, Fly). Build `npm run build`, start `npm start`. Set the env vars; set `FRONT_ORIGIN` to the FRONT URL.
- **FRONT**: Vercel (root directory `FRONT`). Set `NEXT_PUBLIC_API_URL` to the BACK URL and optionally `DEMO_PASSWORD`.
- Both must be served over HTTPS for the microphone to work.

## 8. Rules to keep (from the founder's specs)

Product:
- The **manager opens** the conversation; the employee never speaks first.
- Employee: starts slightly defensive, reveals information gradually, never coaches, never breaks character, ends naturally via `end_conversation`.
- Coach: no scores, grades, personality labels, diagnoses or theory names. Quotes must be **exact** (keep `verifyQuote`). Outcome only if it really happened. Short / early-ended conversations are marked limited.
- Exactly **three** feedback rows: what worked, what to improve, recommendation to continue.
- Feedback actions are exactly: "Practise the same conversation again" (primary) and "Practise a different situation". No step bar at the top of screens.
- Recording: notice before every call, opt-out, delete from the personal area.

UI / code:
- Use design tokens from `app/globals.css` (`var(--blue-500)`, `var(--space-4)`, …). No new colours, no gradients, one primary button per screen.
- Use logical CSS (`margin-inline-start`, `inset-inline-end`) so RTL works. Test Hebrew after every UI change.
- Every UI string goes in `lib/i18n.ts` in **all three** languages.
- Never put the OpenAI key or prompts in FRONT. New AI calls go through a BACK route.
- Validate all browser input in BACK (`src/lib/validate.ts`).

## 9. Known limitations / next steps

- Personal area and recordings are **browser-local** (no accounts). Accounts + server storage ("option G") is a separate, unapproved scope.
- Avatars are placeholders; add portraits in `FRONT/public/avatars/` or integrate a video-avatar provider in `components/Avatar.tsx`.
- Report "save" is print-to-PDF; a server-generated PDF can be added in BACK if required.
- The logo is a low-res capture from the mockup; replace `FRONT/public/logo.png` and `mark.png` with the vector originals.
- Rate limiting is in-memory (one instance only).

## 10. Testing

Run the 10 scenarios in `docs/TEST_PLAN.md` in live mode (with a key) in all three languages before every demo.
