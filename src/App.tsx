import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  FolderViewResponse,
  ProgressPayload,
  ScanCompletePayload,
  ScanStatus,
} from "./types";
import { Treemap } from "./features/treemap/Treemap";
import { Breadcrumb } from "./features/breadcrumb/Breadcrumb";
import {
  ProgressStrip,
  WarningBanner,
  StatusBar,
} from "./features/scan-status/StatusComponents";
import { getStableHue } from "./lib/utils";
import "./App.css";

function App() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [unreadablePaths, setUnreadablePaths] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<FolderViewResponse | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initialScanRef = useRef(false);

  useEffect(() => {
    const unlistenProgress = listen<ProgressPayload>("scan-progress", (event) => {
      setProgress(event.payload);
    });

    const unlistenComplete = listen<ScanCompletePayload>("scan-complete", (event) => {
      setStatus("complete");
      setProgress(null);
      setCurrentView(event.payload.root_view);
      setUnreadablePaths(event.payload.unreadable_paths);
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
        const targetIndex = currentView.current_path.length - 2;
        handleNavigateBreadcrumb(targetIndex);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentView, status]);

  async function handleStartScan(targetPath?: string) {
    setStatus("scanning");
    setErrorMessage(null);
    setProgress(null);
    try {
      await invoke("start_scan", { targetPath: targetPath || null });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already in progress")) {
        return;
      }
      setStatus("error");
      setErrorMessage(msg);
    }
  }

  async function handleCancelScan() {
    await invoke("cancel_scan");
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
      console.error("Failed to drill down:", err);
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
      console.error("Failed to navigate:", err);
    }
  }

  const baseHue =
    currentView && currentView.current_path.length > 1
      ? getStableHue(currentView.current_path[1])
      : undefined;

  const currentErrorsCount =
    status === "scanning" && progress
      ? progress.errors
      : unreadablePaths.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          height: "44px",
          background: "#18181b",
          borderBottom: "1px solid #27272a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "-0.02em" }}>
            du-sk
          </span>
          {currentView && (
            <Breadcrumb
              path={currentView.current_path}
              onNavigate={handleNavigateBreadcrumb}
              disabled={status === "scanning"}
            />
          )}
        </div>

        <div>
          {status === "scanning" ? (
            <button
              onClick={handleCancelScan}
              style={{
                background: "#7f1d1d",
                color: "#fecaca",
                border: "none",
                padding: "4px 12px",
                borderRadius: "4px",
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
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                padding: "4px 12px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Rescan
            </button>
          )}
        </div>
      </header>

      {status === "scanning" && <ProgressStrip progress={progress} />}

      <WarningBanner
        errorCount={currentErrorsCount}
        unreadablePaths={unreadablePaths}
      />

      <main style={{ flex: 1, position: "relative" }}>
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
            <div style={{ color: "#f87171" }}>Scan failed: {errorMessage}</div>
            <button
              onClick={() => handleStartScan()}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: "4px",
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
              color: "#a1a1aa",
            }}
          >
            <div>Scan was cancelled.</div>
            <button
              onClick={() => handleStartScan()}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Scan
            </button>
          </div>
        ) : currentView ? (
          <Treemap
            tiles={currentView.tiles}
            totalSize={currentView.total_size}
            onDrillDown={handleDrillDown}
            canDrill={status === "complete"}
            baseHue={baseHue}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#71717a",
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
          errorCount={unreadablePaths.length}
        />
      )}
    </div>
  );
}

export default App;
