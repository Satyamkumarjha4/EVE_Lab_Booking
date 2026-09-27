"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Filter state kept in the query string, so filtered views survive reloads and can be shared.
 * Values equal to their default are left out of the URL. Callers need a <Suspense> boundary
 * (useSearchParams requirement).
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const fromUrl = params.get(key as string);
      if (fromUrl !== null) result[key] = fromUrl as T[keyof T];
    }
    return result;
    // `defaults` is a module-level constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback(
    (changes: Partial<T>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === "" || value === defaults[key]) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, pathname, router]
  );

  return [values, update] as const;
}
