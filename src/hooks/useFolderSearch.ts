import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SearchResultItem } from "../types";

export function useFolderSearch(
  currentPathSegments: string[],
  isScanning: boolean
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef(0);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearSearch();
  }, [currentPathSegments, clearSearch]);

  useEffect(() => {
    if (isScanning) {
      clearSearch();
    }
  }, [isScanning, clearSearch]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();

    if (trimmed.length < 2 || isScanning || currentPathSegments.length === 0) {
      setResults([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    const requestId = ++activeRequestIdRef.current;

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res: SearchResultItem[] = await invoke("search_folder", {
          pathSegments: currentPathSegments,
          query: trimmed,
          limit: 100,
        });

        if (requestId === activeRequestIdRef.current) {
          setResults(res);
          setIsOpen(true);
          setSelectedIndex(-1);
        }
      } catch {
        if (requestId === activeRequestIdRef.current) {
          setResults([]);
        }
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 120);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, currentPathSegments, isScanning]);

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
  };
}
