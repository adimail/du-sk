import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { formatBytes } from "../lib/utils";
import { FolderPreset, HoveredTileInfo, RecentPath, SearchResultItem, ScanState } from "../types";
import { SearchBar } from "./SearchBar";

interface HeaderProps {
  scanState: ScanState;
  currentTargetPath: string | null;
  canGoUp: boolean;
  hoveredTile: HoveredTileInfo | null;
  onSelectPath: (path: string) => void;
  onNavigateBreadcrumb: (index: number) => void;
  onNavigateSegments: (segments: string[]) => void;
  onRevealItem?: (item: SearchResultItem) => void;
  onOpenInExplorer?: () => void;
  onGoUp: () => void;
  onCancelScan: () => void;
  onRescan: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  scanState,
  currentTargetPath,
  canGoUp,
  hoveredTile,
  onSelectPath,
  onNavigateBreadcrumb,
  onNavigateSegments,
  onRevealItem,
  onOpenInExplorer,
  onGoUp,
  onCancelScan,
  onRescan,
}) => {
  const [presets, setPresets] = useState<FolderPreset[]>([]);
  const [recentPaths, setRecentPaths] = useState<RecentPath[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isScanning = scanState.status === "scanning";
  const currentPath = scanState.view ? scanState.view.current_path : [];
  const subSegments = currentPath.length > 1 ? currentPath.slice(1) : [];

  const refreshRecents = useCallback(() => {
    invoke<RecentPath[]>("get_recent_paths")
      .then(setRecentPaths)
      .catch(() => {});
  }, []);

  useEffect(() => {
    invoke<FolderPreset[]>("get_folder_presets")
      .then(setPresets)
      .catch(() => {});
    refreshRecents();
  }, [refreshRecents]);

  useEffect(() => {
    if (scanState.status === "complete") {
      refreshRecents();
    }
  }, [scanState.status, refreshRecents]);

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
      const presetMatched = presets.find((p) => p.path === currentTargetPath);
      if (presetMatched) return presetMatched.label;

      const recentMatched = recentPaths.find((r) => r.path === currentTargetPath);
      if (recentMatched) return recentMatched.label;

      const parts = currentTargetPath.replace(/\/$/, "").split("/");
      return parts[parts.length - 1] || currentTargetPath;
    }
    return "Select Target…";
  }, [currentTargetPath, presets, recentPaths]);

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

  async function handleClearRecents(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await invoke("clear_recent_paths");
      setRecentPaths([]);
    } catch {}
  }

  const diskSpace = scanState.diskSpace;
  const currentFolderSize = scanState.view?.total_size || 0;
  const rootTotalSize = scanState.rootTotalBytes || currentFolderSize;

  const diskMetrics = useMemo(() => {
    if (!diskSpace || diskSpace.total_bytes === 0) return null;

    const total = diskSpace.total_bytes;
    const free = diskSpace.available_bytes;
    const used = total > free ? total - free : 0;

    const currentFolder = currentFolderSize;
    const otherScanned = rootTotalSize > currentFolder ? rootTotalSize - currentFolder : 0;
    const totalScanned = currentFolder + otherScanned;
    const otherUsed = used > totalScanned ? used - totalScanned : 0;

    const currentFolderPctOfDrive = (currentFolder / total) * 100;
    const currentFolderPctOfScan = rootTotalSize > 0 ? (currentFolder / rootTotalSize) * 100 : 100;
    const otherScannedPct = (otherScanned / total) * 100;
    const otherUsedPct = (otherUsed / total) * 100;
    const freePct = Math.max(0, 100 - (currentFolderPctOfDrive + otherScannedPct + otherUsedPct));

    return {
      total,
      used,
      free,
      currentFolder,
      currentFolderPctOfDrive,
      currentFolderPctOfScan,
      otherScanned,
      otherScannedPct,
      otherUsedPct,
      freePct,
    };
  }, [diskSpace, currentFolderSize, rootTotalSize]);

  const navButtonClass =
    "flex items-center justify-center w-7 h-7 rounded-md text-xs text-zinc-300 hover:bg-white/10 hover:text-zinc-100 disabled:text-zinc-600 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition-colors";

  const actionButtonClass =
    "flex items-center justify-center h-9 px-4 rounded-lg text-xs font-medium cursor-pointer transition-colors";

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
                <span className={currentTargetPath ? "text-orange-400 font-semibold" : "text-zinc-400 font-normal"}>
                  {rootLabel}
                </span>
                <span className="text-[9px] text-zinc-400">▾</span>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-[#16161b] border border-white/10 rounded-xl p-1.5 min-w-[220px] max-h-96 overflow-y-auto shadow-2xl backdrop-blur-md">
                  <div className="px-2.5 py-1 text-[10px] text-zinc-500 font-medium tracking-wider uppercase select-none">
                    Presets
                  </div>

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

                  {recentPaths.length > 0 && (
                    <>
                      <div className="h-px bg-white/10 my-1.5" />
                      <div className="px-2.5 py-1 flex items-center justify-between text-[10px] text-zinc-500 font-medium tracking-wider uppercase select-none">
                        <span>Recents</span>
                        <button
                          type="button"
                          onClick={handleClearRecents}
                          className="text-[10px] text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>

                      {recentPaths.map((recent) => (
                        <button
                          key={recent.path}
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            onSelectPath(recent.path);
                          }}
                          className={`w-full text-left border-none py-1.5 px-2.5 rounded-md text-xs cursor-pointer transition-colors flex flex-col ${
                            currentTargetPath === recent.path
                              ? "bg-orange-500/15 text-orange-400 font-medium"
                              : "bg-transparent text-zinc-300 hover:bg-white/5"
                          }`}
                        >
                          <span className="font-medium truncate">{recent.label}</span>
                          <span className="text-[10px] text-zinc-500 truncate">{recent.path}</span>
                        </button>
                      ))}
                    </>
                  )}

                  <div className="h-px bg-white/10 my-1.5" />

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

            <div className="flex items-center ml-auto flex-shrink-0 pl-1">
              <button
                type="button"
                onClick={onOpenInExplorer}
                disabled={isScanning || !scanState.view}
                title="Open in File Explorer"
                className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 h-9">
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
              className={`${actionButtonClass} bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10`}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onRescan}
              disabled={!currentTargetPath}
              className={`${actionButtonClass} bg-orange-600 text-white border border-transparent hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed`}
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

      {scanState.status === "complete" && currentFolderSize > 0 && (
        <div className="bg-[#111114] border-t border-white/5 h-7 px-3 text-[11px] text-zinc-500 flex justify-between items-center flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span>
              Folder: <strong className="text-zinc-200 font-medium">{formatBytes(currentFolderSize)}</strong>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              Files: <strong className="text-zinc-300 font-medium">{scanState.totalFiles.toLocaleString()}</strong>
            </span>

            {hoveredTile ? (
              <>
                <span className="text-zinc-700">·</span>
                <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded text-orange-300 min-w-0 truncate">
                  <span className="font-semibold text-zinc-100 truncate">{hoveredTile.name}</span>
                  <span className="text-orange-400/80">({formatBytes(hoveredTile.size)})</span>
                  <span className="text-zinc-500 text-[10px]">
                    {currentFolderSize > 0 ? ((hoveredTile.size / currentFolderSize) * 100).toFixed(1) : "0.0"}% of folder
                    {diskMetrics ? ` · ${((hoveredTile.size / diskMetrics.total) * 100).toFixed(2)}% of drive` : ""}
                  </span>
                </div>
              </>
            ) : diskMetrics ? (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-zinc-400">
                  <strong className="text-orange-400/90 font-medium">{diskMetrics.currentFolderPctOfDrive.toFixed(1)}%</strong> of drive
                  {subSegments.length > 0 && (
                    <span className="text-zinc-500 ml-1">
                      ({diskMetrics.currentFolderPctOfScan.toFixed(1)}% of scanned root)
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="text-zinc-700">·</span>
                <span>
                  Duration: <strong className="text-zinc-300 font-medium">{scanState.duration.toFixed(2)}s</strong>
                </span>
              </>
            )}
          </div>

          {diskMetrics && (
            <div className="flex items-center gap-2.5 flex-shrink-0 select-none">
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span>Drive:</span>
                <span className="text-zinc-200 font-medium">{formatBytes(diskMetrics.used)}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-400">{formatBytes(diskMetrics.total)}</span>
              </div>

              <div
                className="w-32 h-2 rounded-full bg-zinc-800 flex overflow-hidden border border-white/10"
                title={`Active Folder: ${formatBytes(diskMetrics.currentFolder)} (${diskMetrics.currentFolderPctOfDrive.toFixed(1)}%)\nOther Scanned: ${formatBytes(diskMetrics.otherScanned)}\nOther Drive Space: ${formatBytes(diskMetrics.used - rootTotalSize)}\nFree: ${formatBytes(diskMetrics.free)}`}
              >
                <div
                  style={{ width: `${Math.min(diskMetrics.currentFolderPctOfDrive, 100)}%` }}
                  className="bg-orange-500 transition-all duration-150"
                />
                <div
                  style={{ width: `${Math.min(diskMetrics.otherScannedPct, 100)}%` }}
                  className="bg-orange-950 transition-all duration-150"
                />
                <div
                  style={{ width: `${Math.min(diskMetrics.otherUsedPct, 100)}%` }}
                  className="bg-zinc-600 transition-all duration-150"
                />
                <div
                  style={{ width: `${Math.min(diskMetrics.freePct, 100)}%` }}
                  className="bg-zinc-900 transition-all duration-150"
                />
              </div>

              <span className="text-[10px] text-zinc-400 font-medium">
                {formatBytes(diskMetrics.free)} free
              </span>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
