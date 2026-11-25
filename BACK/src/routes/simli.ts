import { Router } from "express";
import { env } from "../lib/env";
import { coachFace, faceFor } from "../lib/faces";
import { parseSetup } from "../lib/validate";

const SIMLI = "https://api.simli.ai";

interface IceServer { urls: string | string[]; username?: string; credential?: string }

/** Temporary ICE servers so the browser can open the face over a direct WebRTC connection. */
async function iceServers(key: string): Promise<IceServer[]> {
  try {
    const res = await fetch(`${SIMLI}/compose/ice`, { headers: { "x-simli-api-key": key, Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((server) => server && (server.urls || server.url))
      .map((server) => ({
        urls: server.urls || server.url,
        ...(server.username ? { username: server.username } : {}),
        ...(server.credential ? { credential: server.credential } : {})
      }));
  } catch {
    return [];
  }
}

/** The call stage is 16:9. The coach card is a portrait, so her frame is 9:16. */
const FRAME = {
  employee: { streaming_width: 1280, streaming_height: 720, avatar_position_x: 0.5, avatar_position_y: 0.86, camera: { zoom: 1.28 } },
  coach: { streaming_width: 720, streaming_height: 1280, avatar_position_x: 0.5, avatar_position_y: 0.78, camera: { zoom: 1.4 } }
} as const;

/**
 * POST /api/simli/session { setup } or { who: "coach" }
 * Mints a short-lived Simli session. The API key stays on the server;
 * the browser only receives the session token.
 * Faces are Simli's ready-made presets. Silence does not reset the mouth.
 */
export const simliRouter = Router().post("/", async (req, res) => {
  const coach = req.body?.who === "coach";
  const setup = coach ? null : parseSetup(req.body?.setup);
  if (!coach && !setup) return res.status(400).json({ error: "bad_setup" });
  const key = env.simliKey();
  if (!key) return res.json({ enabled: false });

  const faceId = coach ? coachFace() : faceFor(setup!.employee);
  try {
    const tokenRes = await fetch(`${SIMLI}/compose/token`, {
      method: "POST",
      headers: { "x-simli-api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        faceId,
        handleSilence: false,
        maxSessionLength: env.simliMaxSession,
        maxIdleTime: env.simliMaxIdle,
        ...FRAME[coach ? "coach" : "employee"]
      })
    });
    if (!tokenRes.ok) {
      console.error("[simli] token failed", tokenRes.status);
      return res.status(502).json({ error: "avatar_unavailable" });
    }
    const data = (await tokenRes.json()) as { session_token?: string; warnings?: string[] };
    if (data.warnings?.length) console.warn("[simli] framing", data.warnings.join("; "));
    if (!data.session_token) return res.status(502).json({ error: "avatar_unavailable" });
    const ice = await iceServers(key);
    res.json({ enabled: true, token: data.session_token, iceServers: ice, faceId });
  } catch (e) {
    console.error("[simli] network error", e);
    res.status(502).json({ error: "avatar_unavailable" });
  }
});
