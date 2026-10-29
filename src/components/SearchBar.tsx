import React, { useRef, useEffect } from "react";
import { formatBytes } from "../lib/utils";
import { useFolderSearch } from "../hooks/useFolderSearch";
import { SearchResultItem } from "../types";

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
  } = useFolderSearch(currentPathSegments, isScanning);

  const currentFolder =
    currentPathSegments.length > 0
      ? currentPathSegments[currentPathSegments.length - 1]
      : "folder";

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

  function handleSelectResult(item: SearchResultItem) {
    if (item.is_dir) {
      onNavigateToSegments(item.path_segments);
    } else if (onRevealItem) {
      onRevealItem(item.path_segments);
    } else if (item.path_segments.length > 1) {
      onNavigateToSegments(item.path_segments.slice(0, -1));
    }
    clearSearch();
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      clearSearch();
      inputRef.current?.blur();
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
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectResult(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelectResult(results[0]);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative flex items-center">
      <div className="relative flex items-center">
        <span className="absolute left-2.5 text-zinc-500 text-[11px] pointer-events-none select-none">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={isScanning}
          placeholder={isScanning ? "Scanning..." : `Search in ${currentFolder}...`}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-7 w-48 sm:w-56 md:w-64 bg-white/5 border border-white/10 rounded-lg pl-7 pr-12 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 max-h-80 bg-[#16161b] border border-white/10 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden z-50 flex flex-col">
          <div className="h-6 px-3 bg-white/[0.03] border-b border-white/5 flex items-center justify-between text-[10px] text-zinc-400 select-none">
            <span>
              {isSearching
                ? "Searching..."
                : `${results.length} match${results.length === 1 ? "" : "es"}`}
            </span>
            <span>in {currentFolder}</span>
          </div>

          <div className="overflow-y-auto max-h-72 divide-y divide-white/[0.03]">
            {results.length === 0 && !isSearching ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                No matches found in this folder
              </div>
            ) : (
              results.map((item, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <button
                    key={`${item.path_segments.join("/")}-${index}`}
                    type="button"
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-3 text-xs border-none cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-orange-500/15 text-orange-200"
                        : "bg-transparent text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono font-semibold ${
                            item.is_dir
                              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                              : "bg-zinc-700/30 text-zinc-400 border border-zinc-700/40"
                          }`}
                        >
                          {item.is_dir ? "DIR" : "FILE"}
                        </span>
                        <span className="truncate font-medium">{item.name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {item.relative_path}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0">
                      {formatBytes(item.size)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
