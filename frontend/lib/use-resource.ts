"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Settled<T> {
  key: string;
  data?: T;
  error?: unknown;
}

/**
 * Loads async data keyed by `key`: a new key (or `reload()`) refetches. `setData` lets a page
 * apply the result of a mutation locally instead of refetching everything.
 */
export function useResource<T>(load: () => Promise<T>, key: string) {
  const loadRef = useRef(load);
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const requestKey = `${key}#${nonce}`;

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    loadRef.current().then(
      (data) => active && setSettled({ key: requestKey, data }),
      (error) => active && setSettled({ key: requestKey, error })
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((update: (prev: T) => T) => {
    setSettled((prev) =>
      prev && prev.data !== undefined ? { ...prev, data: update(prev.data) } : prev
    );
  }, []);

  // Keep showing the previous data for the same key during a reload, but never another key's.
  const sameKey = settled?.key.startsWith(`${key}#`) ?? false;
  return {
    data: sameKey ? settled?.data : undefined,
    error: sameKey ? settled?.error : undefined,
    loading: settled?.key !== requestKey,
    reload,
    setData,
  };
}
