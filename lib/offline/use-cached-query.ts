"use client";

import { useEffect, useRef } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { cacheGet, cacheSet } from "./db";

interface Options<T> extends Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, "queryKey" | "queryFn"> {
  cacheKey: string;
}

export function useCachedQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  opts: Options<T>,
) {
  const result = useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      try {
        const fresh = await fetcher();
        cacheSet(opts.cacheKey, fresh);
        return fresh;
      } catch (err) {
        const cached = await cacheGet<T>(opts.cacheKey);
        if (cached) return cached;
        throw err;
      }
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    ...opts,
  });

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || result.data) return;
    hydrated.current = true;
    cacheGet<T>(opts.cacheKey).then(cached => {
      if (cached && !result.data) {
        // hydrate via cache; query will still run in background
      }
    });
  }, [opts.cacheKey, result.data]);

  return result;
}
