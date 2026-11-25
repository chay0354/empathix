import { Router } from "express";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { OPENAI, env, isMock } from "../lib/env";

const STYLE: Record<string, string> = {
  he: "Speak natural Israeli Hebrew.",
  en: "Speak natural English.",
  fr: "Speak natural French."
};

/**
 * POST /api/tts  { text, lang }  →  audio/mpeg
 * The coach's voice. In mock mode returns 404 and FRONT falls back to the browser's speech synthesis.
 */
export const ttsRouter = Router().post("/", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.slice(0, 3000) : "";
  const lang = typeof req.body?.lang === "string" && req.body.lang in STYLE ? req.body.lang : "en";
  if (!text) return res.status(400).json({ error: "empty" });
  if (isMock()) return res.status(404).json({ mock: true });
  try {
    const r = await fetch(`${OPENAI}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.ttsModel(),
        voice: env.ttsVoice(),
        input: text,
        instructions: `You are a warm, calm, professional communication coach giving feedback. Unhurried, supportive, clear. ${STYLE[lang]}`,
        response_format: "mp3"
      })
    });
    if (!r.ok || !r.body) {
      console.error("[tts] failed", r.status);
      return res.status(502).json({ error: "tts_failed" });
    }
    res.setHeader("content-type", "audio/mpeg");
    res.setHeader("cache-control", "no-store");
    Readable.fromWeb(r.body as unknown as WebReadableStream).pipe(res);
  } catch (e) {
    console.error("[tts] error", e);
    res.status(502).json({ error: "tts_failed" });
  }
});
