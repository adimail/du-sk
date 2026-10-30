import React, { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { formatBytes } from "../lib/utils";
import { FolderPreset, SearchResultItem, ScanState } from "../types";
import { SearchBar } from "./SearchBar";

interface HeaderProps {
  scanState: ScanState;
  currentTargetPath: string | null;
  canGoUp: boolean;
  onSelectPath: (path: string) => void;
  onNavigateBreadcrumb: (index: number) => void;
  onNavigateSegments: (segments: string[]) => void;
  onRevealItem?: (item: SearchResultItem) => void;
  onGoUp: () => void;
  onCancelScan: () => void;
  onRescan: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  scanState,
  currentTargetPath,
  canGoUp,
  onSelectPath,
  onNavigateBreadcrumb,
  onNavigateSegments,
  onRevealItem,
  onGoUp,
  onCancelScan,
  onRescan,
}) => {
  const [presets, setPresets] = useState<FolderPreset[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isScanning = scanState.status === "scanning";
  const currentPath = scanState.view ? scanState.view.current_path : [];
  const subSegments = currentPath.length > 1 ? currentPath.slice(1) : [];

  useEffect(() => {
    invoke<FolderPreset[]>("get_folder_presets")
      .then(setPresets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rootLabel = useMemo(() => {
    if (currentTargetPath) {
      const matched = presets.find((p) => p.path === currentTargetPath);
      if (matched) return matched.label;
      const parts = currentTargetPath.replace(/\/$/, "").split("/");
      return parts[parts.length - 1] || currentTargetPath;
    }
    const homePreset = presets.find((p) => p.label.includes("Home"));
    if (homePreset) return homePreset.label;
    return "Home (~)";
  }, [currentTargetPath, presets]);

  async function handlePickCustomFolder() {
    setDropdownOpen(false);
    try {
      const chosen = await open({
        directory: true,
        multiple: false,
        title: "Select folder to scan",
      });
      if (typeof chosen === "string") {
        onSelectPath(chosen);
      }
    } catch {}
  }

  const navButtonClass =
    "flex items-center justify-center w-7 h-7 rounded-md text-xs text-zinc-300 hover:bg-white/10 hover:text-zinc-100 disabled:text-zinc-600 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition-colors";

  return (
    <header className="flex flex-col flex-shrink-0 z-40 bg-[#131317] border-b border-white/5">
      <div className="h-12 flex items-center justify-between px-3 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-semibold text-xs text-zinc-100 tracking-tight flex-shrink-0 select-none">
            du-sk
          </span>

          <div className="flex items-center gap-1 min-w-0 flex-1 h-9 bg-white/5 border border-white/10 rounded-lg px-1">
            <button
              type="button"
              onClick={onGoUp}
              disabled={!canGoUp || isScanning}
              aria-label="Up one level"
              className={`${navButtonClass} flex-shrink-0`}
            >
              ↑
            </button>

            <div className="w-px h-4 bg-white/10 mx-1 flex-shrink-0" />

            <div ref={dropdownRef} className="relative flex-shrink-0">
              <button
                type="button"
                disabled={isScanning}
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium text-zinc-100 hover:bg-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-orange-400 font-semibold">{rootLabel}</span>
                <span className="text-[9px] text-zinc-400">▾</span>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-[#16161b] border border-white/10 rounded-xl p-1.5 min-w-[200px] shadow-2xl backdrop-blur-md">
                  {presets.map((preset) => (
                    <button
                      key={preset.path}
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onSelectPath(preset.path);
                      }}
                      className={`w-full text-left border-none py-1.5 px-2.5 rounded-md text-xs cursor-pointer transition-colors ${
                        currentTargetPath === preset.path
                          ? "bg-orange-500/15 text-orange-400 font-medium"
                          : "bg-transparent text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}

                  <div className="h-px bg-white/10 my-1" />

                  <button
                    type="button"
                    onClick={handlePickCustomFolder}
                    className="w-full text-left bg-transparent border-none text-zinc-100 py-1.5 px-2.5 rounded-md text-xs font-medium cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    Choose Folder…
                  </button>
                </div>
              )}
            </div>

            {subSegments.length > 0 && (
              <nav className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">
                {subSegments.map((segment, index) => {
                  const isLast = index === subSegments.length - 1;
                  const actualTargetIndex = index + 1;

                  return (
                    <React.Fragment key={`${segment}-${index}`}>
                      <span className="text-zinc-600 text-[11px] select-none flex-shrink-0">/</span>
                      {isLast ? (
                        <span className="text-zinc-100 font-medium text-xs truncate py-0.5 px-1.5 rounded bg-white/10 flex-shrink-0">
                          {segment}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => onNavigateBreadcrumb(actualTargetIndex)}
                          className="bg-transparent border-none py-0.5 px-1.5 text-xs rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/5 cursor-pointer truncate flex-shrink-0 transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed"
                        >
                          {segment}
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <SearchBar
            currentPathSegments={currentPath}
            isScanning={isScanning}
            onNavigateToSegments={onNavigateSegments}
            onRevealItem={onRevealItem}
          />

          {isScanning ? (
            <button
              type="button"
              onClick={onCancelScan}
              className="bg-white/5 text-zinc-300 border border-white/10 py-2 px-4.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onRescan}
              className="bg-orange-600 text-white border-none py-2 px-4.5 rounded-lg text-xs font-medium cursor-pointer shadow-md shadow-orange-600/20 hover:bg-orange-500 transition-colors"
            >
              Rescan
            </button>
          )}
        </div>
      </div>

      {isScanning && (
        <div className="bg-[#16161a] border-t border-white/5 relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-orange-400 animate-progress" />
          <div className="h-7 px-4 text-xs text-zinc-400 flex justify-between items-center">
            <div className="flex items-center gap-5">
              <span>
                Files: <strong className="text-zinc-100 font-mono">{scanState.progress ? scanState.progress.files.toLocaleString() : 0}</strong>
              </span>
              <span className="text-zinc-600">|</span>
              <span>
                Size: <strong className="text-zinc-100 font-mono">{formatBytes(scanState.progress ? scanState.progress.bytes : 0)}</strong>
              </span>
              <span className="text-zinc-600">|</span>
              <span>
                Time: <strong className="text-zinc-100 font-mono">{scanState.progress ? scanState.progress.elapsed_secs.toFixed(1) : "0.0"}s</strong>
              </span>
            </div>
            <div className="text-orange-400/90 text-[11px] font-medium flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Scanning…
            </div>
          </div>
        </div>
      )}

      {scanState.status === "complete" && (scanState.view?.total_size || 0) > 0 && (
        <div className="bg-[#111114] border-t border-white/5 h-6 px-4 text-[11px] text-zinc-500 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-4">
            <span>
              Total: <strong className="text-zinc-300 font-medium">{formatBytes(scanState.view?.total_size || 0)}</strong>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              Files: <strong className="text-zinc-300 font-medium">{scanState.totalFiles.toLocaleString()}</strong>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              Duration: <strong className="text-zinc-300 font-medium">{scanState.duration.toFixed(2)}s</strong>
            </span>
          </div>
          <div className="text-zinc-500 text-[10px]">Ready</div>
        </div>
      )}
    </header>
  );
};
