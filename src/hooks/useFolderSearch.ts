import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SearchResultItem } from "../types";

export const RESULT_LIMIT = 50;
const DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 2;

interface PendingSearch {
  key: string;
  query: string;
  scope: string[];
}

export function useFolderSearch(
  currentPathSegments: string[],
  isScanning: boolean,
  searchAll: boolean
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const lastKeyRef = useRef<string | null>(null);
  const pendingRef = useRef<PendingSearch | null>(null);
  const inFlightRef = useRef(false);
  const segmentsRef = useRef(currentPathSegments);
  segmentsRef.current = currentPathSegments;

  const pathKey = currentPathSegments.join("/");
  const scopeKey = searchAll ? currentPathSegments[0] ?? "" : pathKey;

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const clearSearch = useCallback(() => {
    cancelTimer();
    requestIdRef.current += 1;
    inFlightRef.current = false;
    lastKeyRef.current = null;
    setQuery("");
    setResults([]);
    setIsSearching(false);
    setIsOpen(false);
    setSelectedIndex(-1);
  }, [cancelTimer]);

  const runSearch = useCallback(async (trimmed: string, scope: string[]) => {
    const requestId = ++requestIdRef.current;
    inFlightRef.current = true;
    setIsSearching(true);

    try {
      const res = await invoke<SearchResultItem[]>("search_folder", {
        pathSegments: scope,
        query: trimmed,
        limit: RESULT_LIMIT,
      });

      if (requestId === requestIdRef.current) {
        setResults(res);
        setIsOpen(true);
        setSelectedIndex(res.length > 0 ? 0 : -1);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setResults([]);
        setSelectedIndex(-1);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
        setIsSearching(false);
      }
    }
  }, []);

  const searchNow = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    cancelTimer();
    lastKeyRef.current = pending.key;
    runSearch(pending.query, pending.scope);
  }, [cancelTimer, runSearch]);

  useEffect(() => {
    clearSearch();
  }, [pathKey, clearSearch]);

  useEffect(() => {
    if (isScanning) {
      clearSearch();
    }
  }, [isScanning, clearSearch]);

  useEffect(() => {
    const trimmed = query.trim();
    const scope = searchAll
      ? segmentsRef.current.slice(0, 1)
      : segmentsRef.current;

    if (trimmed.length < MIN_QUERY_LENGTH || isScanning || scope.length === 0) {
      cancelTimer();
      requestIdRef.current += 1;
      inFlightRef.current = false;
      lastKeyRef.current = null;
      setResults([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    const key = `${searchAll ? "all" : "dir"}\u0000${scopeKey}\u0000${trimmed}`;

    if (key === lastKeyRef.current) {
      setIsSearching(inFlightRef.current);
      return;
    }

    cancelTimer();
    setIsSearching(true);
    pendingRef.current = { key, query: trimmed, scope };
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingRef.current = null;
      lastKeyRef.current = key;
      runSearch(trimmed, scope);
    }, DEBOUNCE_MS);

    return cancelTimer;
  }, [query, scopeKey, searchAll, isScanning, cancelTimer, runSearch]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    isOpen,
    setIsOpen,
    selectedIndex,
    setSelectedIndex,
    clearSearch,
    searchNow,
  };
}
