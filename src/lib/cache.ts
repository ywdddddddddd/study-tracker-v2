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

/** 从缓存读取，过期或不存在返回 null */
export async function cacheGet<T>(table: string, key: string): Promise<T | null> {
  try {
    const entry = await db.cache.get(table + '::' + key);
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > CACHE_TTL) return null; // 过期
    return entry.data;
  } catch {
    return null; // IndexedDB 被禁用或出错
  }
}

/** 写入缓存 */
export async function cacheSet<T>(table: string, key: string, data: T): Promise<void> {
  try {
    await db.cache.put({ key: table + '::' + key, data, updatedAt: Date.now() });
  } catch { /* ignore cache write errors */ }
}

/** 删除缓存 */
export async function cacheDel(table: string, key: string): Promise<void> {
  try {
    await db.cache.delete(table + '::' + key);
  } catch { /* ignore */ }
}

/** 带缓存的数据获取：先读缓存，miss 时调 fetchFn */
export async function cachedFetch<T>(
  table: string,
  key: string,
  fetchFn: () => Promise<T | null>
): Promise<T | null> {
  const cached = await cacheGet<T>(table, key);
  if (cached !== null) return cached;
  const fresh = await fetchFn();
  if (fresh !== null) await cacheSet(table, key, fresh);
  return fresh;
}

/** 带缓存的列表获取 */
export async function cachedFetchList<T>(
  table: string,
  key: string,
  fetchFn: () => Promise<T[]>
): Promise<T[]> {
  const cached = await cacheGet<T[]>(table, key);
  if (cached !== null) return cached;
  const fresh = await fetchFn();
  await cacheSet(table, key, fresh);
  return fresh;
}

/** 写入时同时更新缓存 */
export async function cacheWrite<T>(table: string, key: string, data: T): Promise<void> {
  await cacheSet(table, key, data);
}

/** 删除数据时清除缓存 */
export async function cacheInvalidate(table: string, key: string): Promise<void> {
  await cacheDel(table, key);
}
