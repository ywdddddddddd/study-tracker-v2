import Dexie, { type Table } from 'dexie';

interface CacheEntry<T> {
  key: string;       // "{table}::{id}" e.g. "daily_plans::2026-05-09"
  data: T;
  updatedAt: number; // Date.now()
}

class StudyCacheDB extends Dexie {
  cache!: Table<CacheEntry<any>, string>;

  constructor() {
    super('study-tracker-cache');
    this.version(1).stores({
      cache: 'key, updatedAt',
    });
  }
}

const db = new StudyCacheDB();
const CACHE_TTL = 2 * 60 * 1000; // 2 分钟过期

// Start with cache DISABLED. Only enable after first successful read/write.
// This prevents stale cache issues on mobile where IndexedDB may be unreliable.
let cacheDisabled = true;
let cacheEnabled = false;

/** 从缓存读取，过期或不存在返回 null */
export async function cacheGet<T>(table: string, key: string): Promise<T | null> {
  if (cacheDisabled) return null;
  try {
    const entry = await db.cache.get(table + '::' + key);
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > CACHE_TTL) return null;
    cacheEnabled = true;
    return entry.data;
  } catch {
    return null;
  }
}

/** 写入缓存 */
export async function cacheSet<T>(table: string, key: string, data: T): Promise<void> {
  if (cacheDisabled && !cacheEnabled) return;
  try {
    await db.cache.put({ key: table + '::' + key, data, updatedAt: Date.now() });
    cacheEnabled = true;
  } catch { /* ignore */ }
}

/** 删除缓存 */
export async function cacheDel(table: string, key: string): Promise<void> {
  if (cacheDisabled && !cacheEnabled) return;
  try { await db.cache.delete(table + '::' + key); cacheEnabled = true; } catch { /* ignore */ }
}

export async function cachedFetch<T>(table: string, key: string, fetchFn: () => Promise<T | null>): Promise<T | null> {
  if (!cacheEnabled && cacheDisabled) return fetchFn();
  const cached = await cacheGet<T>(table, key);
  if (cached !== null) return cached;
  const fresh = await fetchFn();
  if (fresh !== null) await cacheSet(table, key, fresh);
  return fresh;
}

export async function cachedFetchList<T>(table: string, key: string, fetchFn: () => Promise<T[]>): Promise<T[]> {
  if (!cacheEnabled && cacheDisabled) return fetchFn();
  const cached = await cacheGet<T[]>(table, key);
  if (cached !== null) return cached;
  const fresh = await fetchFn();
  await cacheSet(table, key, fresh);
  return fresh;
}

export async function cacheWrite<T>(table: string, key: string, data: T): Promise<void> {
  if (cacheDisabled && !cacheEnabled) return;
  await cacheDel(table, key);
  await cacheSet(table, key, data);
}

export async function cacheInvalidate(table: string, key: string): Promise<void> {
  await cacheDel(table, key);
}
