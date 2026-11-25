import { Router } from "express";
import { isMock } from "../lib/env";

/** GET /api/config — tells FRONT whether the server is in mock mode (no API key). */
export const configRouter = Router().get("/", (_req, res) => {
  res.json({ mock: isMock() });
});
