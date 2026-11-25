/** Base URL of the BACK server (Express). Set NEXT_PUBLIC_API_URL in FRONT/.env.local. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export const api = (path: string, init?: RequestInit) => fetch(`${API_URL}${path}`, init);
