import { Router } from "express";
import { OPENAI, env, isMock } from "../lib/env";
import { employeeInstructions } from "../lib/prompts";
import { EMPLOYEES } from "../lib/scenarios";
import { parseSetup } from "../lib/validate";

/**
 * POST /api/realtime/session  { setup, challenge? }
 * Mints a short-lived (2 min) OpenAI Realtime client secret configured as the employee.
 * The browser then opens a WebRTC call directly with OpenAI using that secret,
 * so audio never passes through this server and the real API key never reaches the browser.
 */
export const sessionRouter = Router().post("/", async (req, res) => {
  const setup = parseSetup(req.body?.setup);
  if (!setup) return res.status(400).json({ error: "bad_setup" });
  if (isMock()) return res.json({ mock: true });

  const challenge = typeof req.body?.challenge === "string" ? req.body.challenge.slice(0, 400) : null;
  const model = env.realtimeModel();
  const session = {
    type: "realtime",
    model,
    instructions: employeeInstructions(setup, challenge),
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: env.transcribeModel(), language: setup.lang },
        noise_reduction: { type: "near_field" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 400,
          silence_duration_ms: 720,
          create_response: true,
          interrupt_response: true
        }
      },
      output: { voice: EMPLOYEES[setup.employee].voice }
    },
    tools: [
      {
        type: "function",
        name: "end_conversation",
        description: "Call after you have said a short natural closing line, when the conversation has reached its natural end.",
        parameters: { type: "object", properties: {}, additionalProperties: false }
      }
    ],
    tool_choice: "auto"
  };

  try {
    const r = await fetch(`${OPENAI}/realtime/client_secrets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 120 }, session })
    });
    if (!r.ok) {
      console.error("[session] client_secrets failed", r.status, (await r.text().catch(() => "")).slice(0, 500));
      return res.status(502).json({ error: "ai_unavailable" });
    }
    const data = (await r.json()) as { value: string };
    res.json({ value: data.value, model });
  } catch (e) {
    console.error("[session] network error", e);
    res.status(502).json({ error: "ai_unavailable" });
  }
});
