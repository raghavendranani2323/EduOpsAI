"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "eduops-offline";
const DB_VERSION = 1;

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  cachedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") return Promise.reject(new Error("idb only in browser"));
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("queries"))   db.createObjectStore("queries",   { keyPath: "key" });
        if (!db.objectStoreNames.contains("mutations")) db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
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

export async function queueMutation(payload: { url: string; method: string; body: unknown }): Promise<void> {
  try {
    const db = await getDB();
    await db.add("mutations", { ...payload, queuedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function flushMutations(): Promise<{ flushed: number; failed: number }> {
  let flushed = 0;
  let failed = 0;
  try {
    const db = await getDB();
    const all = await db.getAll("mutations") as Array<{ id: number; url: string; method: string; body: unknown }>;
    for (const m of all) {
      try {
        const res = await fetch(m.url, {
          method: m.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m.body),
        });
        if (res.ok) {
          await db.delete("mutations", m.id);
          flushed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  } catch { /* ignore */ }
  return { flushed, failed };
}
