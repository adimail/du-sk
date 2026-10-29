import React, { useRef, useEffect, useState, useCallback } from "react";
import { useFolderSearch, RESULT_LIMIT } from "../hooks/useFolderSearch";
import { SearchResultItem } from "../types";
import { SearchResultRow } from "./SearchResultRow";

interface SearchBarProps {
  currentPathSegments: string[];
  isScanning: boolean;
  onNavigateToSegments: (segments: string[]) => void;
  onRevealItem?: (segments: string[]) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  currentPathSegments,
  isScanning,
  onNavigateToSegments,
  onRevealItem,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [searchAll, setSearchAll] = useState(false);

  const {
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
  } = useFolderSearch(currentPathSegments, isScanning, searchAll);

  const trimmedQuery = query.trim();
  const currentFolder =
    currentPathSegments.length > 0
      ? currentPathSegments[currentPathSegments.length - 1]
      : "folder";
  const rootFolder =
    currentPathSegments.length > 0 ? currentPathSegments[0] : "folder";
  const scopeLabel = searchAll ? rootFolder : currentFolder;

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [results]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelectResult = useCallback(
    (item: SearchResultItem, reveal: boolean) => {
      if (reveal && onRevealItem) {
        onRevealItem(item.path_segments);
      } else if (item.is_dir) {
        onNavigateToSegments(item.path_segments);
      } else if (onRevealItem) {
        onRevealItem(item.path_segments);
      } else if (item.path_segments.length > 1) {
        onNavigateToSegments(item.path_segments.slice(0, -1));
      }
      clearSearch();
      inputRef.current?.blur();
    },
    [onNavigateToSegments, onRevealItem, clearSearch]
  );

  const handleRowSelect = useCallback(
    (index: number, reveal: boolean) => {
      const item = results[index];
      if (item) handleSelectResult(item, reveal);
    },
    [results, handleSelectResult]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      clearSearch();
      inputRef.current?.blur();
      return;
    }

    if (e.key === "Enter" && isSearching) {
      e.preventDefault();
      searchNow();
      return;
    }

    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleRowSelect(selectedIndex >= 0 ? selectedIndex : 0, e.metaKey || e.ctrlKey);
    }
  }

  const countLabel =
    results.length >= RESULT_LIMIT
      ? `${RESULT_LIMIT}+ matches`
      : `${results.length} match${results.length === 1 ? "" : "es"}`;

  const scopeButtonClass = (active: boolean) =>
    `px-2 py-0.5 rounded text-[10px] border-none cursor-pointer transition-colors ${
      active
        ? "bg-orange-500/20 text-orange-300"
        : "bg-transparent text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <div ref={containerRef} className="relative flex items-center">
      <div className="relative flex items-center">
        <span className="absolute left-2.5 flex items-center justify-center w-3 h-3 text-zinc-500 text-[11px] pointer-events-none select-none">
          {isSearching ? (
            <span className="block w-3 h-3 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
          ) : (
            "🔍"
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={isScanning}
          placeholder={isScanning ? "Scanning..." : `Search in ${scopeLabel}...`}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (trimmedQuery.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-7 w-48 sm:w-56 md:w-64 bg-white/5 border border-white/10 rounded-lg pl-8 pr-12 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="text-zinc-400 hover:text-zinc-200 text-xs px-1 cursor-pointer bg-transparent border-none"
            >
              ✕
            </button>
          ) : (
            <kbd className="hidden sm:inline-block text-[9px] font-mono text-zinc-500 bg-white/5 border border-white/10 px-1 py-0.5 rounded select-none pointer-events-none">
              ⌘F
            </kbd>
          )}
        </div>
      </div>

      {isOpen && trimmedQuery.length >= 2 && (
        <div className="absolute top-full right-0 mt-1.5 w-[28rem] max-w-[calc(100vw-1.5rem)] max-h-96 bg-[#16161b] border border-white/10 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden z-50 flex flex-col">
          <div className="h-8 px-3 flex-shrink-0 bg-white/[0.03] border-b border-white/5 flex items-center justify-between text-[10px] text-zinc-400 select-none">
            <span>
              {isSearching && results.length === 0 ? "Searching…" : countLabel}
            </span>
            <div className="flex items-center gap-0.5 rounded-md bg-white/5 p-0.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchAll(false)}
                className={scopeButtonClass(!searchAll)}
              >
                {currentFolder}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchAll(true)}
                className={scopeButtonClass(searchAll)}
              >
                Everywhere
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            className={`overflow-y-auto flex-1 min-h-0 divide-y divide-white/[0.03] transition-opacity ${
              isSearching && results.length > 0 ? "opacity-60" : "opacity-100"
            }`}
          >
            {results.length === 0 ? (
              isSearching ? null : (
                <div className="py-6 text-center text-xs text-zinc-500">
                  Nothing in {scopeLabel} matches “{trimmedQuery}”
                </div>
              )
            ) : (
              results.map((item, index) => (
                <SearchResultRow
                  key={item.path_segments.join("/")}
                  item={item}
                  index={index}
                  isSelected={selectedIndex === index}
                  query={trimmedQuery}
                  onSelect={handleRowSelect}
                  onHover={setSelectedIndex}
                />
              ))
            )}
          </div>

          <div className="h-7 px-3 flex-shrink-0 border-t border-white/5 bg-white/[0.02] flex items-center gap-4 text-[10px] text-zinc-500 select-none">
            <span>↑↓ move</span>
            <span>↵ open</span>
            <span>⌘↵ show in Finder</span>
            <span>esc close</span>
          </div>
        </div>
      )}
    </div>
  );
};
