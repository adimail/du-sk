import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  FolderViewResponse,
  ProgressPayload,
  ScanCompletePayload,
  ScanState,
  TileItem,
} from "../types";

export function useFolderScan(targetPath: string | null) {
  const [scanState, setScanState] = useState<ScanState>({
    status: "idle",
    progress: null,
    view: null,
    totalFiles: 0,
    duration: 0,
    error: null,
  });

  const initialScanRef = useRef(false);

  const startScan = useCallback(async (overridePath?: string) => {
    const path = overridePath || targetPath || undefined;

    setScanState((prev) => ({
      ...prev,
      status: "scanning",
      error: null,
      progress: null,
    }));

    try {
      await invoke("start_scan", { targetPath: path || null });
    } catch (err) {
      const message = String(err);
      if (message.includes("already in progress")) return;

      setScanState((prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }, [targetPath]);

  const cancelScan = useCallback(async () => {
    await invoke("cancel_scan");
  }, []);

  const drillDown = useCallback(async (folderName: string) => {
    if (!scanState.view || scanState.status === "scanning") return;

    const nextBreadcrumb = [...scanState.view.current_path, folderName];
    try {
      const response: FolderViewResponse = await invoke("get_folder_children", {
        pathSegments: nextBreadcrumb,
      });

      setScanState((prev) => ({
        ...prev,
        view: response,
      }));
    } catch (err) {
      console.error(err);
    }
  }, [scanState.view, scanState.status]);

  const navigateBreadcrumb = useCallback(async (index: number) => {
    if (!scanState.view || scanState.status === "scanning") return;

    const targetBreadcrumb = scanState.view.current_path.slice(0, index + 1);
    try {
      const response: FolderViewResponse = await invoke("get_folder_children", {
        pathSegments: targetBreadcrumb,
      });

      setScanState((prev) => ({
        ...prev,
        view: response,
      }));
    } catch (err) {
      console.error(err);
    }
  }, [scanState.view, scanState.status]);

  useEffect(() => {
    const unlistenProgress = listen<ProgressPayload>("scan-progress", (event) => {
      setScanState((prev) => ({
        ...prev,
        progress: event.payload,
      }));
    });

    const unlistenComplete = listen<ScanCompletePayload>("scan-complete", (event) => {
      setScanState({
        status: "complete",
        progress: null,
        view: event.payload.root_view,
        totalFiles: event.payload.total_files,
        duration: event.payload.elapsed_secs,
        error: null,
      });
    });

    const unlistenCancelled = listen("scan-cancelled", () => {
      setScanState((prev) => ({
        ...prev,
        status: "cancelled",
        progress: null,
        view: null,
      }));
    });

    const unlistenError = listen<string>("scan-error", (event) => {
      setScanState((prev) => ({
        ...prev,
        status: "error",
        error: event.payload,
        progress: null,
      }));
    });

    if (!initialScanRef.current) {
      initialScanRef.current = true;
      startScan();
    }

    return () => {
      unlistenProgress.then((f) => f());
      unlistenComplete.then((f) => f());
      unlistenCancelled.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, [startScan]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "Backspace" &&
        scanState.view &&
        scanState.view.current_path.length > 1 &&
        scanState.status !== "scanning"
      ) {
        navigateBreadcrumb(scanState.view.current_path.length - 2);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scanState.view, scanState.status, navigateBreadcrumb]);

  const liveTiles = useMemo((): TileItem[] => {
    if (scanState.status !== "scanning" || !scanState.progress?.live_tiles) {
      return [];
    }

    return scanState.progress.live_tiles.map((b) => ({
      name: b.name,
      size: b.size,
      is_dir: b.is_dir,
      incomplete: false,
      is_aggregate: false,
      aggregate_count: 0,
      children: [],
    }));
  }, [scanState.status, scanState.progress]);

  const activeTiles =
    scanState.status === "scanning" && liveTiles.length > 0
      ? liveTiles
      : scanState.view?.tiles || [];

  const activeTotal =
    scanState.status === "scanning"
      ? scanState.progress?.bytes || 0
      : scanState.view?.total_size || 0;

  return {
    scanState,
    startScan,
    cancelScan,
    drillDown,
    navigateBreadcrumb,
    activeTiles,
    activeTotal,
  };
}
