import "dotenv/config";

export const OPENAI = "https://api.openai.com/v1";

/** All configuration comes from environment variables (see BACK/.env.example). */
export const env = {
  port: Number(process.env.PORT) || 4000,
  frontOrigins: (process.env.FRONT_ORIGIN || "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),
  key: () => process.env.OPENAI_API_KEY || "",
  realtimeModel: () => process.env.REALTIME_MODEL || "gpt-realtime",
  transcribeModel: () => process.env.REALTIME_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
  coachModel: () => process.env.COACH_MODEL || "gpt-4.1",
  ttsModel: () => process.env.TTS_MODEL || "gpt-4o-mini-tts",
  ttsVoice: () => process.env.TTS_VOICE || "marin",
  ratePerMin: Number(process.env.RATE_LIMIT_PER_MIN) || 30,
  simliKey: () => process.env.SIMLI_API_KEY || "",
  simliMaxSession: Number(process.env.SIMLI_MAX_SESSION_SECONDS) || 600,
  simliMaxIdle: Number(process.env.SIMLI_MAX_IDLE_SECONDS) || 120
};

export const isMock = () => !env.key();
