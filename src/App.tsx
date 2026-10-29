import { useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Header } from "./components/Header";
import { Treemap } from "./components/Treemap";
import { useFolderScan } from "./hooks/useFolderScan";
import "./App.css";

function App() {
  const [currentTargetPath, setCurrentTargetPath] = useState<string | null>(null);

  const {
    scanState,
    startScan,
    cancelScan,
    drillDown,
    navigateBreadcrumb,
    navigateToSegments,
    goUp,
    canGoUp,
    activeTiles,
    activeTotal,
    currentDirectoryPath,
    scannedRootPath,
  } = useFolderScan(currentTargetPath);

  function handleSelectPath(path: string) {
    setCurrentTargetPath(path);
    startScan(path);
  }

  function handleRescan() {
    const target = currentDirectoryPath || currentTargetPath || undefined;
    if (target) {
      setCurrentTargetPath(target);
      startScan(target);
    } else {
      startScan();
    }
  }

  async function handleRevealItem(segments: string[]) {
    const base = scannedRootPath || currentTargetPath;
    if (!base || segments.length === 0) return;

    const relSegments = segments.length > 1 ? segments.slice(1) : [];
    const fullPath = `${base.replace(/\/+$/, "")}/${relSegments.join("/")}`;

    try {
      await revealItemInDir(fullPath);
    } catch {
      if (segments.length > 1) {
        navigateToSegments(segments.slice(0, -1));
      }
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#0e0e11] overflow-hidden">
      <Header
        scanState={scanState}
        currentTargetPath={currentTargetPath}
        canGoUp={canGoUp}
        onSelectPath={handleSelectPath}
        onNavigateBreadcrumb={navigateBreadcrumb}
        onNavigateSegments={navigateToSegments}
        onRevealItem={handleRevealItem}
        onGoUp={goUp}
        onCancelScan={cancelScan}
        onRescan={handleRescan}
      />

      <main className="flex-1 relative p-2 overflow-hidden min-h-0">
        {scanState.status === "error" ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-red-400 text-xs">{scanState.error}</div>
            <button
              type="button"
              onClick={handleRescan}
              className="bg-orange-600 text-white border-none py-1.5 px-4 rounded-lg text-xs cursor-pointer hover:bg-orange-500 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : scanState.status === "cancelled" ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500 text-xs">
            <div>Scan cancelled</div>
            <button
              type="button"
              onClick={handleRescan}
              className="bg-orange-600 text-white border-none py-1.5 px-4 rounded-lg text-xs cursor-pointer hover:bg-orange-500 transition-colors"
            >
              Start Scan
            </button>
          </div>
        ) : activeTiles.length > 0 ? (
          <Treemap
            tiles={activeTiles}
            totalSize={activeTotal}
            onDrillDown={drillDown}
            canDrill={scanState.status === "complete"}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
            Starting scan…
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
