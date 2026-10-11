import { useState, useEffect, useCallback, useRef } from 'react';
import { appCache, deepEqual } from '../lib/cache';

interface UseOptimizedDataOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  initialData?: T | null;
  enabled?: boolean;
}

interface UseOptimizedDataReturn<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  refresh: (opts?: { silent?: boolean }) => Promise<T | null>;
  setData: (updater: T | ((prev: T | null) => T)) => void;
}

export function useOptimizedData<T>({
  key,
  fetcher,
  initialData = null as T | null,
  enabled = true,
}: UseOptimizedDataOptions<T>): UseOptimizedDataReturn<T> {
  const [data, setDataState] = useState<T | null>(() => {
    const cached = appCache.getMemory<T>(key);
    return cached !== null ? cached : initialData;
  });

  // Track if we have displayed ANY data (cached or initial) yet
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = appCache.getMemory<T>(key);
    return cached === null && initialData === null;
  });

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const keyRef = useRef(key);
  keyRef.current = key;

  const dataRef = useRef(data);
  dataRef.current = data;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Custom setter that updates React state + cache only when changed
  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      if (!deepEqual(prev, next)) {
        appCache.set(keyRef.current, next);
        return next;
      }
      return prev;
    });
  }, []);

  // Hydrate cache on mount if not in memory
  useEffect(() => {
    let isMounted = true;
    if (enabled && dataRef.current === null) {
      appCache.get<T>(key).then((cached) => {
        if (isMounted && cached !== null) {
          setDataState(cached);
          setLoading(false);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [key, enabled]);

  // Main refresh function with SWR (Stale-While-Revalidate)
  const refresh = useCallback(
    async (opts?: { silent?: boolean }): Promise<T | null> => {
      if (!enabled) return dataRef.current;

      const isSilent = opts?.silent ?? dataRef.current !== null;
      if (!isSilent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const freshData = await fetcherRef.current();
        // Update state and cache ONLY if payload changed
        if (!deepEqual(dataRef.current, freshData)) {
          setDataState(freshData);
          await appCache.set(keyRef.current, freshData);
        }
        return freshData;
      } catch (err: any) {
        setError(err);
        return dataRef.current;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled],
  );

  return {
    data,
    loading,
    refreshing,
    error,
    refresh,
    setData,
  };
}
