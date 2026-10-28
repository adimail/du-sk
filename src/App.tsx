import { useState } from "react";
import { Treemap } from "./features/treemap/Treemap";
import { Breadcrumb } from "./features/breadcrumb/Breadcrumb";
import { ProgressStrip, StatusBar } from "./features/scan-status/StatusComponents";
import { FolderSelector } from "./components/FolderSelector";
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
    activeTiles,
    activeTotal,
  } = useFolderScan(currentTargetPath);

  function handleSelectPath(path: string) {
    setCurrentTargetPath(path);
    startScan(path);
  }

  const canGoBack = Boolean(scanState.view && scanState.view.current_path.length > 1);

  return (
    <div className="flex flex-col h-screen bg-[#0e0e11]">
      <header className="h-12 bg-[#131317] border-b border-white/5 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-zinc-100 tracking-tight">
            du-sk
          </span>

          <FolderSelector
            currentPath={currentTargetPath}
            onSelectPath={handleSelectPath}
            disabled={scanState.status === "scanning"}
          />

          {canGoBack && (
            <button
              type="button"
              onClick={() => navigateBreadcrumb(scanState.view!.current_path.length - 2)}
              disabled={scanState.status === "scanning"}
              className="flex items-center justify-center bg-white/5 border border-white/10 w-6.5 h-6.5 rounded-full text-xs transition-colors cursor-pointer text-zinc-100 hover:bg-white/10 disabled:text-zinc-600 disabled:cursor-default"
            >
              ←
            </button>
          )}

          {scanState.view && scanState.view.current_path.length > 0 && (
            <Breadcrumb
              path={scanState.view.current_path}
              onNavigate={navigateBreadcrumb}
              disabled={scanState.status === "scanning"}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {scanState.status === "scanning" ? (
            <button
              type="button"
              onClick={cancelScan}
              className="bg-white/5 text-zinc-300 border border-white/10 py-1 px-3.5 rounded-full text-xs font-medium cursor-pointer hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startScan()}
              className="bg-orange-600 text-white border-none py-1 px-4 rounded-full text-xs font-medium cursor-pointer shadow-md shadow-orange-600/20 hover:bg-orange-500 transition-colors"
            >
              Rescan
            </button>
          )}
        </div>
      </header>

      {scanState.status === "scanning" && (
        <ProgressStrip progress={scanState.progress} />
      )}

      <main className="flex-1 relative p-3 overflow-hidden">
        {scanState.status === "error" ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-red-400 text-xs">{scanState.error}</div>
            <button
              type="button"
              onClick={() => startScan()}
              className="bg-orange-600 text-white border-none py-1.5 px-4 rounded-full text-xs cursor-pointer hover:bg-orange-500 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : scanState.status === "cancelled" ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500 text-xs">
            <div>Scan cancelled</div>
            <button
              type="button"
              onClick={() => startScan()}
              className="bg-orange-600 text-white border-none py-1.5 px-4 rounded-full text-xs cursor-pointer hover:bg-orange-500 transition-colors"
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

      {scanState.view && (
        <StatusBar
          totalBytes={scanState.view.total_size}
          totalFiles={scanState.totalFiles}
          durationSecs={scanState.duration}
        />
      )}
    </div>
  );
}

export default App;
