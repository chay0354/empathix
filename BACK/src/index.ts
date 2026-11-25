import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env, isMock } from "./lib/env";
import { coachRouter } from "./routes/coach";
import { configRouter } from "./routes/config";
import { sessionRouter } from "./routes/session";
import { simliRouter } from "./routes/simli";
import { ttsRouter } from "./routes/tts";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
const allowed = (origin: string) => {
  if (env.frontOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || (host.endsWith(".vercel.app") && host.startsWith("empathix"));
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowed(origin)),
    methods: ["GET", "POST"]
  })
);

/** Tiny in-memory rate limit per IP (enough for a demo; use a shared store in production). */
const hits = new Map<string, { n: number; reset: number }>();
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + 60_000 });
  else if (++h.n > env.ratePerMin) return res.status(429).json({ error: "rate_limited" });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, mock: isMock() }));
app.use("/api/config", configRouter);
app.use("/api/realtime/session", sessionRouter);
app.use("/api/simli/session", simliRouter);
app.use("/api/coach", coachRouter);
app.use("/api/tts", ttsRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server] unhandled", err);
  res.status(500).json({ error: "server_error" });
});

export default app;

// Vercel runs the exported app. Locally we open a port ourselves.
if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`Empathix BACK listening on http://localhost:${env.port}  (${isMock() ? "MOCK mode — no OPENAI_API_KEY" : "live"})`);
    console.log(`Allowed FRONT origins: ${env.frontOrigins.join(", ")}`);
  });
}
