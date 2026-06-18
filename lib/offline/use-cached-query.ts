"use client";

import { useEffect } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { cacheGet, cacheSet } from "./db";
import { useOfflineScope } from "./scope";

interface Options<T> extends Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, "queryKey" | "queryFn"> {
  cacheKey: string;
  /** When true the query won't run on mount — only on `refetch()` or window focus.
   *  Use this when SSR already hydrated the data; the client query just supports offline fallback. */
  ssrSeeded?: boolean;
}

export function useCachedQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  opts: Options<T>,
) {
  const scope = useOfflineScope();
  const result = useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      try {
        const fresh = await fetcher();
        cacheSet(scope, opts.cacheKey, fresh);
        return fresh;
      } catch (err) {
        const cached = await cacheGet<T>(scope, opts.cacheKey);
        if (cached) return cached;
        throw err;
      }
    },
    staleTime: opts.ssrSeeded ? Infinity : 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: opts.ssrSeeded ? false : true,
    ...opts,
  });

  // Writethrough cache on initial data so it survives offline reloads.
  useEffect(() => {
    if (result.data) cacheSet(scope, opts.cacheKey, result.data);
  }, [scope, opts.cacheKey, result.data]);

  return result;
}
