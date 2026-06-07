"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "eduops-offline";
const DB_VERSION = 2;

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  cachedAt: number;
}

export interface MutationEntry {
  id?: number;
  url: string;
  method: string;
  body: unknown;
  dedupeKey?: string;       // mutations with the same key replace each other (last-write-wins)
  queuedAt: number;
  attempts?: number;
  description?: string;     // human-readable for status UI ("Class 6A attendance · 12 Jun")
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") return Promise.reject(new Error("idb only in browser"));
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("queries"))   db.createObjectStore("queries",   { keyPath: "key" });
        if (!db.objectStoreNames.contains("mutations")) {
          const store = db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
          store.createIndex("dedupeKey", "dedupeKey", { unique: false });
        } else if (oldVersion < 2) {
          // v1 -> v2: add dedupeKey index on existing store
          const tx = db.transaction("mutations", "versionchange");
          const store = tx.objectStore("mutations");
          if (!store.indexNames.contains("dedupeKey")) {
            store.createIndex("dedupeKey", "dedupeKey", { unique: false });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    const db = await getDB();
    await db.put("queries", { key, data, cachedAt: Date.now() } satisfies CacheEntry<T>);
  } catch { /* IndexedDB unavailable (private mode) */ }
}

export async function cacheGet<T>(key: string, maxAgeMs = 1000 * 60 * 60 * 24): Promise<T | null> {
  try {
    const db = await getDB();
    const entry = await db.get("queries", key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > maxAgeMs) return entry.data;
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Queue a mutation for later sync. If `dedupeKey` is provided, any existing
 * mutation with the same key is replaced — useful for attendance where the
 * latest submission for a class+date supersedes earlier ones.
 */
export async function queueMutation(payload: Omit<MutationEntry, "id" | "queuedAt" | "attempts">): Promise<void> {
  try {
    const db = await getDB();
    if (payload.dedupeKey) {
      const tx = db.transaction("mutations", "readwrite");
      const idx = tx.store.index("dedupeKey");
      let cursor = await idx.openCursor(IDBKeyRange.only(payload.dedupeKey));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.store.add({ ...payload, queuedAt: Date.now(), attempts: 0 });
      await tx.done;
    } else {
      await db.add("mutations", { ...payload, queuedAt: Date.now(), attempts: 0 });
    }
  } catch (e) {
    console.error("[queueMutation] failed", e);
  }
}

export async function getPendingMutations(): Promise<MutationEntry[]> {
  try {
    const db = await getDB();
    return (await db.getAll("mutations")) as MutationEntry[];
  } catch {
    return [];
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count("mutations");
  } catch {
    return 0;
  }
}

export async function flushMutations(): Promise<{ flushed: number; failed: number; remaining: number }> {
  let flushed = 0;
  let failed = 0;
  try {
    const db = await getDB();
    const all = (await db.getAll("mutations")) as MutationEntry[];
    for (const m of all) {
      try {
        const res = await fetch(m.url, {
          method: m.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m.body),
        });
        if (res.ok) {
          if (m.id !== undefined) await db.delete("mutations", m.id);
          flushed++;
        } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          // 4xx (except timeout/rate-limit) = client error, never going to succeed; drop it
          if (m.id !== undefined) await db.delete("mutations", m.id);
          failed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    const remaining = await db.count("mutations");
    return { flushed, failed, remaining };
  } catch {
    return { flushed, failed, remaining: 0 };
  }
}

/**
 * Try fetch first; on network failure or while offline, queue the mutation.
 * Returns { ok: true, queued: false } on direct success, { ok: true, queued: true } if queued,
 * or { ok: false } if the server rejected with a 4xx (validation etc.).
 */
export async function submitOrQueue(payload: Omit<MutationEntry, "id" | "queuedAt" | "attempts">): Promise<
  { ok: true; queued: false; response: unknown } |
  { ok: true; queued: true } |
  { ok: false; error: string; status: number }
> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (!isOffline) {
    try {
      const res = await fetch(payload.url, {
        method: payload.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return { ok: true, queued: false, response: json };
      }
      // Server reachable but rejected — don't queue 4xx (validation failure)
      if (res.status >= 400 && res.status < 500) {
        const json = await res.json().catch(() => ({}));
        return { ok: false, error: json.error ?? `HTTP ${res.status}`, status: res.status };
      }
      // 5xx — fall through to queueing
    } catch {
      // network failure — fall through to queueing
    }
  }

  await queueMutation(payload);
  return { ok: true, queued: true };
}
