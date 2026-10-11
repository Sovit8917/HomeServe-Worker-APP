import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'hs_worker_cache_v1_';
const memoryCache = new Map<string, any>();

export const CACHE_KEYS = {
  WORKER_PROFILE: 'worker_profile',
  TODAY_JOBS: 'today_jobs',
  PENDING_REQUESTS: 'pending_requests',
  PENDING_REASON: 'pending_reason',
  UPCOMING_JOBS: 'upcoming_jobs',
  JOB_HISTORY: 'job_history',
  EARNINGS_TODAY: 'earnings_today',
  EARNINGS_SUMMARY: 'earnings_summary',
  JOB_DETAIL: (id: string) => `job_detail_${id}`,
  UNREAD_CHAT: (id: string) => `unread_chat_${id}`,
};

/** Deep structural equality check to prevent unnecessary React re-renders. */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

export const appCache = {
  /** Synchronous read from memory cache */
  getMemory<T>(key: string): T | null {
    const fullKey = CACHE_PREFIX + key;
    return (memoryCache.get(fullKey) as T) ?? null;
  },

  /** Async read from AsyncStorage with memory fallback */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = CACHE_PREFIX + key;
    if (memoryCache.has(fullKey)) {
      return memoryCache.get(fullKey) as T;
    }
    try {
      const raw = await AsyncStorage.getItem(fullKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      memoryCache.set(fullKey, parsed);
      return parsed as T;
    } catch {
      return null;
    }
  },

  /** Save item to memory and AsyncStorage */
  async set<T>(key: string, value: T): Promise<void> {
    const fullKey = CACHE_PREFIX + key;
    memoryCache.set(fullKey, value);
    try {
      await AsyncStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // Storage write error non-fatal
    }
  },

  /** Remove item */
  async remove(key: string): Promise<void> {
    const fullKey = CACHE_PREFIX + key;
    memoryCache.delete(fullKey);
    try {
      await AsyncStorage.removeItem(fullKey);
    } catch {
      // Storage delete error non-fatal
    }
  },
};
