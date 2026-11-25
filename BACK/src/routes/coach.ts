import { Router } from "express";
import { OPENAI, env, isMock } from "../lib/env";
import { mockFeedback } from "../lib/mock";
import { FEEDBACK_SCHEMA, coachSystem, coachUser, transcriptText, verifyQuote } from "../lib/prompts";
import { LANG_NAME, employeeOf } from "../lib/scenarios";
import type { Feedback } from "../lib/types";
import { parseFeedback, parseSetup, parseTurns } from "../lib/validate";

/**
 * POST /api/coach  { setup, transcript, endedBy, durationSec, previous?, previousTranscript? }
 * Runs the AI coach on the transcript and returns structured feedback (JSON schema).
 * Grounding guard: quotes not literally present in a manager turn are removed.
 */
export const coachRouter = Router().post("/", async (req, res) => {
  const b = req.body ?? {};
  const setup = parseSetup(b.setup);
  if (!setup) return res.status(400).json({ error: "bad_setup" });
  const turns = parseTurns(b.transcript);
  const prevTurns = parseTurns(b.previousTranscript);
  const previous = parseFeedback(b.previous);
  const endedBy = ["manager", "employee", "time"].includes(b.endedBy) ? b.endedBy : "manager";
  const durationSec = Math.max(0, Math.min(3600, Number(b.durationSec) || 0));

  if (isMock()) return res.json({ feedback: mockFeedback(setup, turns, endedBy, !!previous) });

  const name = employeeOf(setup).name;
  try {
    const r = await fetch(`${OPENAI}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.coachModel(),
        temperature: 0.4,
        response_format: { type: "json_schema", json_schema: FEEDBACK_SCHEMA },
        messages: [
          { role: "system", content: coachSystem(LANG_NAME[setup.lang]) },
          {
            role: "user",
            content: coachUser({
              setup,
              transcript: transcriptText(turns, name),
              endedBy,
              durationSec,
              previous,
              previousTranscript: prevTurns.length ? transcriptText(prevTurns, name) : null
            })
          }
        ]
      })
    });
    if (!r.ok) {
      console.error("[coach] failed", r.status, (await r.text().catch(() => "")).slice(0, 500));
      return res.status(502).json({ error: "coach_failed" });
    }
    const data = (await r.json()) as { choices: { message: { content: string } }[] };
    const fb = JSON.parse(data.choices[0].message.content) as Feedback;
    fb.worked.quote = verifyQuote(fb.worked.quote, turns);
    fb.improve.quote = verifyQuote(fb.improve.quote, turns);
    if (turns.filter((t) => t.role === "manager" && t.text.trim()).length < 4) fb.limited = true;
    if (!previous) fb.comparison = null;
    res.json({ feedback: fb });
  } catch (e) {
    console.error("[coach] error", e);
    res.status(502).json({ error: "coach_failed" });
  }
});
