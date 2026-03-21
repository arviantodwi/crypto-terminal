export interface Article {
  description: string;
  link: string;
  pubDate: string;
  source: string;
  timeAgo: string;
  title: string;
}

export interface CacheEntry {
  articles: Article[];
  fetchedAt: number;
}

export const CACHE_TTL = 60_000;

let globalCacheEntry: CacheEntry | null = null;
const coinCacheMap = new Map<string, CacheEntry>();

export function getGlobalCache(): CacheEntry | null {
  return globalCacheEntry;
}

export function isGlobalCacheValid(): boolean {
  return globalCacheEntry !== null && Date.now() - globalCacheEntry.fetchedAt < CACHE_TTL;
}

export function setGlobalCache(entry: CacheEntry): void {
  globalCacheEntry = entry;
}

export function getCoinCache(coin: string): CacheEntry | null {
  return coinCacheMap.get(coin) ?? null;
}

export function isCoinCacheValid(coin: string): boolean {
  const entry = coinCacheMap.get(coin);
  return entry !== undefined && Date.now() - entry.fetchedAt < CACHE_TTL;
}

export function setCoinCache(coin: string, entry: CacheEntry): void {
  coinCacheMap.set(coin, entry);
}
