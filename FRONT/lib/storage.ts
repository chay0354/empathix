"use client";
import type { SessionRecord } from "./types";

/**
 * Personal area storage for the demo. Reports live in localStorage; recordings (audio blobs)
 * in IndexedDB. Nothing is uploaded to a server. Swap for an authenticated backend later.
 */
const KEY = "empathix.sessions.v1";
const DB = "empathix";
const STORE = "recordings";

export function listSessions(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as SessionRecord[]) : [];
    return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function getSession(id: string): SessionRecord | undefined {
  return listSessions().find((s) => s.id === id);
}

export function saveSession(rec: SessionRecord) {
  try {
    const all = listSessions().filter((s) => s.id !== rec.id);
    all.unshift(rec);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 100)));
  } catch {
    /* storage full or blocked: the session still works, it just isn't kept */
  }
}

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const saveRecording = (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id)).catch(() => undefined);
export const getRecording = (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(id)).catch(() => undefined);

export async function deleteSession(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listSessions().filter((s) => s.id !== id)));
  } catch {}
  await tx("readwrite", (s) => s.delete(id)).catch(() => undefined);
}

export const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random())).replace(/-/g, "").slice(0, 20);
