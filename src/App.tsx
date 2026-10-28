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
import { ProgressStrip, StatusBar } from "./features/scan-status/StatusComponents";
import "./App.css";

function App() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
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
    setStatus("scanning");
    setErrorMessage(null);
    setProgress(null);
    try {
      await invoke("start_scan", { targetPath: targetPath || null });
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0f0f11" }}>
      <header
        style={{
          height: "48px",
          background: "#131316",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontWeight: 600, fontSize: "13px", color: "#f4f4f5", letterSpacing: "-0.01em" }}>
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
        ) : currentView ? (
          <Treemap
            tiles={currentView.tiles}
            totalSize={currentView.total_size}
            onDrillDown={handleDrillDown}
            canDrill={status === "complete"}
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
