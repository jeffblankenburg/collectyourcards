"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResults } from "@/lib/catalog/types";

const EMPTY: SearchResults = { players: [], teams: [], sets: [], series: [], cards: [] };
const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

// Robust as-you-type search:
//  • trailing debounce (one request per typing pause, not per keystroke)
//  • AbortController cancels the in-flight request when the query changes
//  • monotonic sequence id + latest-term guard => a slow earlier response can
//    never overwrite a newer one (no flicker / wrong results)
//  • in-memory cache => instant results on backspace / repeat queries, no refetch
//  • min length + unmount cleanup
export function useEntitySearch(query: string) {
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const cache = useRef<Map<string, SearchResults>>(new Map());
  const seq = useRef(0);
  const latest = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = query.trim().toLowerCase();
    latest.current = term;
    if (timer.current) clearTimeout(timer.current);

    if (term.length < MIN_CHARS) {
      controller.current?.abort();
      setResults(EMPTY);
      setLoading(false);
      setElapsed(null);
      return;
    }

    const cached = cache.current.get(term);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    timer.current = setTimeout(async () => {
      const id = ++seq.current;
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      const t0 = performance.now();
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ac.signal });
        const data = (await res.json()) as SearchResults;
        cache.current.set(term, data);
        // Apply only if this is still the newest request AND the user hasn't moved on.
        if (id === seq.current && latest.current === term) {
          setResults(data);
          setElapsed(Math.round(performance.now() - t0));
          setLoading(false);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError" && id === seq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  useEffect(
    () => () => { controller.current?.abort(); if (timer.current) clearTimeout(timer.current); },
    [],
  );

  return { results, loading, elapsed };
}
