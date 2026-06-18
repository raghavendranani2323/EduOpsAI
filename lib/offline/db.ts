"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "eduops-offline";
const DB_VERSION = 3;

export interface CacheEntry<T = unknown> {
  key: string;
  scope: string;
  data: T;
  cachedAt: number;
}

export type MutationState = "queued" | "conflict" | "failed";

export interface MutationEntry {
  id?: number;
  scope: string;
  url: string;
  method: string;
  body: unknown;
  dedupeKey?: string;
  queuedAt: number;
  attempts: number;
  state: MutationState;
  description?: string;
  lastError?: string;
}

export interface MutationInput {
  scope: string;
  url: string;
  method: string;
  body: unknown;
  dedupeKey?: string;
  description?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") return Promise.reject(new Error("IndexedDB is browser-only"));
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 3) {
          if (db.objectStoreNames.contains("queries")) db.deleteObjectStore("queries");
          if (db.objectStoreNames.contains("mutations")) db.deleteObjectStore("mutations");
        }
        if (!db.objectStoreNames.contains("queries")) {
          const queries = db.createObjectStore("queries", { keyPath: "key" });
          queries.createIndex("scope", "scope", { unique: false });
        }
        if (!db.objectStoreNames.contains("mutations")) {
          const mutations = db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
          mutations.createIndex("scope", "scope", { unique: false });
          mutations.createIndex("dedupeKey", "dedupeKey", { unique: false });
          mutations.createIndex("state", "state", { unique: false });
        } else if (transaction) {
          const mutations = transaction.objectStore("mutations");
          if (!mutations.indexNames.contains("scope")) mutations.createIndex("scope", "scope", { unique: false });
          if (!mutations.indexNames.contains("state")) mutations.createIndex("state", "state", { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

function scopedKey(scope: string, key: string) {
  return `${scope}:${key}`;
}

export async function cacheSet<T>(scope: string, key: string, data: T): Promise<void> {
  try {
    const db = await getDB();
    await db.put("queries", {
      key: scopedKey(scope, key),
      scope,
      data,
      cachedAt: Date.now(),
    } satisfies CacheEntry<T>);
  } catch {
    // IndexedDB may be unavailable in private browsing.
  }
}

export async function cacheGet<T>(
  scope: string,
  key: string,
  maxAgeMs = 1000 * 60 * 60,
): Promise<T | null> {
  try {
    const db = await getDB();
    const storageKey = scopedKey(scope, key);
    const entry = await db.get("queries", storageKey) as CacheEntry<T> | undefined;
    if (!entry || entry.scope !== scope) return null;
    if (Date.now() - entry.cachedAt > maxAgeMs) {
      await db.delete("queries", storageKey);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export async function queueMutation(payload: MutationInput): Promise<void> {
  const db = await getDB();
  const dedupeKey = payload.dedupeKey ? scopedKey(payload.scope, payload.dedupeKey) : undefined;
  const tx = db.transaction("mutations", "readwrite");
  if (dedupeKey) {
    const idx = tx.store.index("dedupeKey");
    let cursor = await idx.openCursor(IDBKeyRange.only(dedupeKey));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.store.add({
    ...payload,
    dedupeKey,
    queuedAt: Date.now(),
    attempts: 0,
    state: "queued",
  } satisfies Omit<MutationEntry, "id">);
  await tx.done;
}

export async function getMutations(scope: string): Promise<MutationEntry[]> {
  try {
    const db = await getDB();
    return await db.getAllFromIndex("mutations", "scope", scope) as MutationEntry[];
  } catch {
    return [];
  }
}

export async function getPendingCount(scope: string): Promise<number> {
  const entries = await getMutations(scope);
  return entries.filter((entry) => entry.state === "queued").length;
}

export async function getProblemCount(scope: string): Promise<number> {
  const entries = await getMutations(scope);
  return entries.filter((entry) => entry.state !== "queued").length;
}

export async function clearOfflineData(scope?: string): Promise<void> {
  try {
    const db = await getDB();
    if (!scope) {
      await Promise.all([db.clear("queries"), db.clear("mutations")]);
      return;
    }
    for (const storeName of ["queries", "mutations"] as const) {
      const tx = db.transaction(storeName, "readwrite");
      const index = tx.store.index("scope");
      let cursor = await index.openCursor(IDBKeyRange.only(scope));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    }
  } catch {
    // Best-effort privacy cleanup.
  }
}

export async function discardMutation(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("mutations", id);
}

export async function retryMutation(id: number): Promise<void> {
  const db = await getDB();
  await db.transaction("mutations", "readwrite").store.put({
    ...(await db.get("mutations", id) as MutationEntry),
    id,
    state: "queued",
    lastError: undefined,
  });
}

export async function flushMutations(scope: string): Promise<{
  flushed: number;
  failed: number;
  conflicts: number;
  remaining: number;
}> {
  let flushed = 0;
  let failed = 0;
  let conflicts = 0;
  const db = await getDB();
  const all = (await getMutations(scope)).filter((entry) => entry.state === "queued");

  for (const mutation of all) {
    if (mutation.id === undefined) continue;
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation.body),
      });
      if (response.ok) {
        await db.delete("mutations", mutation.id);
        flushed++;
        continue;
      }
      const payload = await response.json().catch(() => ({})) as { error?: string };
      const attempts = mutation.attempts + 1;
      if (response.status === 409) {
        await db.put("mutations", {
          ...mutation,
          attempts,
          state: "conflict",
          lastError: payload.error ?? "The server record changed while you were offline.",
        });
        conflicts++;
      } else if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        await db.put("mutations", {
          ...mutation,
          attempts,
          state: "failed",
          lastError: payload.error ?? `Request rejected (${response.status})`,
        });
        failed++;
      } else {
        await db.put("mutations", { ...mutation, attempts, lastError: "Temporary sync failure" });
        failed++;
      }
    } catch {
      await db.put("mutations", {
        ...mutation,
        attempts: mutation.attempts + 1,
        lastError: "Network unavailable",
      });
      failed++;
    }
  }

  return {
    flushed,
    failed,
    conflicts,
    remaining: await getPendingCount(scope),
  };
}

export async function submitOrQueue(payload: MutationInput): Promise<
  { ok: true; queued: false; response: unknown } |
  { ok: true; queued: true } |
  { ok: false; error: string; status: number }
> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (!isOffline) {
    try {
      const response = await fetch(payload.url, {
        method: payload.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      if (response.ok) {
        return { ok: true, queued: false, response: await response.json().catch(() => ({})) };
      }
      if (response.status >= 400 && response.status < 500) {
        const json = await response.json().catch(() => ({})) as { error?: string };
        return { ok: false, error: json.error ?? `HTTP ${response.status}`, status: response.status };
      }
    } catch {
      // Queue network failures below.
    }
  }
  await queueMutation(payload);
  return { ok: true, queued: true };
}
