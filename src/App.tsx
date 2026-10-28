import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  FolderPreset,
  FolderViewResponse,
  ProgressPayload,
  ScanCompletePayload,
  ScanStatus,
  TileItem,
} from "./types";
import { Treemap } from "./features/treemap/Treemap";
import { Breadcrumb } from "./features/breadcrumb/Breadcrumb";
import { ProgressStrip, StatusBar } from "./features/scan-status/StatusComponents";
import "./App.css";

function App() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [currentView, setCurrentView] = useState<FolderViewResponse | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [presets, setPresets] = useState<FolderPreset[]>([]);
  const [currentTargetPath, setCurrentTargetPath] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSubfolders, setShowSubfolders] = useState(true);
  const initialScanRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<FolderPreset[]>("get_folder_presets").then(setPresets).catch(() => {});
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

  useEffect(() => {
    const unlistenProgress = listen<ProgressPayload>("scan-progress", (event) => {
      setProgress(event.payload);
    });

    const unlistenComplete = listen<ScanCompletePayload>("scan-complete", (event) => {
      setStatus("complete");
      setProgress(null);
      setCurrentView(event.payload.root_view);
      setTotalFiles(event.payload.total_files);
      setDuration(event.payload.elapsed_secs);
    });

    const unlistenCancelled = listen("scan-cancelled", () => {
      setStatus("cancelled");
      setProgress(null);
      setCurrentView(null);
    });

    const unlistenError = listen<string>("scan-error", (event) => {
      setStatus("error");
      setErrorMessage(event.payload);
      setProgress(null);
    });

    if (!initialScanRef.current) {
      initialScanRef.current = true;
      handleStartScan();
    }

    return () => {
      unlistenProgress.then((f) => f());
      unlistenComplete.then((f) => f());
      unlistenCancelled.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "Backspace" &&
        currentView &&
        currentView.current_path.length > 1 &&
        status !== "scanning"
      ) {
        handleNavigateBreadcrumb(currentView.current_path.length - 2);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentView, status]);

  async function handleStartScan(targetPath?: string) {
    const path = targetPath || currentTargetPath || undefined;
    setStatus("scanning");
    setErrorMessage(null);
    setProgress(null);
    try {
      await invoke("start_scan", { targetPath: path || null });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already in progress")) return;
      setStatus("error");
      setErrorMessage(msg);
    }
  }

  async function handleCancelScan() {
    await invoke("cancel_scan");
  }

  async function handleSelectPreset(preset: FolderPreset) {
    setDropdownOpen(false);
    setCurrentTargetPath(preset.path);
    await handleStartScan(preset.path);
  }

  async function handlePickCustomFolder() {
    setDropdownOpen(false);
    try {
      const chosen = await invoke<string | null>("pick_folder");
      if (chosen) {
        setCurrentTargetPath(chosen);
        await handleStartScan(chosen);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDrillDown(folderName: string) {
    if (!currentView || status === "scanning") return;
    const nextBreadcrumb = [...currentView.current_path, folderName];
    try {
      const response: FolderViewResponse = await invoke("get_folder_children", {
        pathSegments: nextBreadcrumb,
      });
      setCurrentView(response);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleNavigateBreadcrumb(index: number) {
    if (!currentView || status === "scanning") return;
    const targetBreadcrumb = currentView.current_path.slice(0, index + 1);
    try {
      const response: FolderViewResponse = await invoke("get_folder_children", {
        pathSegments: targetBreadcrumb,
      });
      setCurrentView(response);
    } catch (err) {
      console.error(err);
    }
  }

  const liveTiles = useMemo((): TileItem[] => {
    if (status !== "scanning" || !progress?.live_tiles) return [];
    return progress.live_tiles.map((b) => ({
      name: b.name,
      size: b.size,
      is_dir: b.is_dir,
      incomplete: false,
      is_aggregate: false,
      aggregate_count: 0,
      children: [],
    }));
  }, [status, progress]);

  const activeTiles = status === "scanning" && liveTiles.length > 0
    ? liveTiles
    : currentView?.tiles || [];

  const activeTotal = status === "scanning"
    ? (progress ? progress.bytes : 0)
    : (currentView ? currentView.total_size : 0);

  const displayTargetName = useMemo(() => {
    if (currentTargetPath) {
      const matched = presets.find((p) => p.path === currentTargetPath);
      if (matched) return matched.label;
      const parts = currentTargetPath.replace(/\/$/, "").split("/");
      return parts[parts.length - 1] || currentTargetPath;
    }
    return "Library";
  }, [currentTargetPath, presets]);

  const canGoBack = Boolean(currentView && currentView.current_path.length > 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0e0e11" }}>
      <header
        style={{
          height: "48px",
          background: "#131317",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: 600, fontSize: "13px", color: "#f4f4f5", letterSpacing: "-0.01em" }}>
            du-sk
          </span>

          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: "#f4f4f5",
                padding: "3px 10px",
                borderRadius: "16px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <span>{displayTargetName}</span>
              <span style={{ fontSize: "9px", color: "#a1a1aa" }}>▼</span>
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "32px",
                  left: 0,
                  zIndex: 9999,
                  background: "#16161b",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  padding: "5px",
                  minWidth: "170px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                }}
              >
                {presets.map((preset) => (
                  <button
                    key={preset.path}
                    onClick={() => handleSelectPreset(preset)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: currentTargetPath === preset.path ? "rgba(251, 146, 60, 0.15)" : "transparent",
                      border: "none",
                      color: currentTargetPath === preset.path ? "#fb923c" : "#e4e4e7",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}

                <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />

                <button
                  onClick={handlePickCustomFolder}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    color: "#f4f4f5",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Choose Folder…
                </button>
              </div>
            )}
          </div>

          {canGoBack && (
            <button
              onClick={() => handleNavigateBreadcrumb(currentView!.current_path.length - 2)}
              disabled={status === "scanning"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: status === "scanning" ? "#52525b" : "#f4f4f5",
                width: "26px",
                height: "26px",
                borderRadius: "13px",
                fontSize: "12px",
                cursor: status === "scanning" ? "default" : "pointer",
              }}
            >
              ←
            </button>
          )}

          {currentView && currentView.current_path.length > 0 && (
            <Breadcrumb
              path={currentView.current_path}
              onNavigate={handleNavigateBreadcrumb}
              disabled={status === "scanning"}
            />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setShowSubfolders(!showSubfolders)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: showSubfolders ? "rgba(251, 146, 60, 0.12)" : "rgba(255, 255, 255, 0.06)",
              border: `1px solid ${showSubfolders ? "rgba(251, 146, 60, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
              color: showSubfolders ? "#fb923c" : "#a1a1aa",
              padding: "5px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <span>Sub-folders</span>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: showSubfolders ? "#fb923c" : "#71717a",
              }}
            />
          </button>

          {status === "scanning" ? (
            <button
              onClick={handleCancelScan}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                color: "#d4d4d8",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "5px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => handleStartScan()}
              style={{
                background: "#ea580c",
                color: "#ffffff",
                border: "none",
                padding: "5px 16px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(234, 88, 12, 0.25)",
              }}
            >
              Rescan
            </button>
          )}
        </div>
      </header>

      {status === "scanning" && <ProgressStrip progress={progress} />}

      <main style={{ flex: 1, position: "relative", padding: "12px" }}>
        {status === "error" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
            }}
          >
            <div style={{ color: "#f87171", fontSize: "13px" }}>{errorMessage}</div>
            <button
              onClick={() => handleStartScan()}
              style={{
                background: "#ea580c",
                color: "#fff",
                border: "none",
                padding: "6px 16px",
                borderRadius: "20px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        ) : status === "cancelled" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
              color: "#71717a",
              fontSize: "13px",
            }}
          >
            <div>Scan cancelled</div>
            <button
              onClick={() => handleStartScan()}
              style={{
                background: "#ea580c",
                color: "#fff",
                border: "none",
                padding: "6px 16px",
                borderRadius: "20px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Start Scan
            </button>
          </div>
        ) : activeTiles.length > 0 ? (
          <Treemap
            tiles={activeTiles}
            totalSize={activeTotal}
            onDrillDown={handleDrillDown}
            canDrill={status === "complete"}
            isScanning={status === "scanning"}
            showSubfolders={showSubfolders}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#71717a",
              fontSize: "13px",
            }}
          >
            Starting scan…
          </div>
        )}
      </main>

      {currentView && (
        <StatusBar
          totalBytes={currentView.total_size}
          totalFiles={totalFiles}
          durationSecs={duration}
        />
      )}
    </div>
  );
}

export default App;
