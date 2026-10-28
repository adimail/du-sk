import React from "react";
import { formatBytes } from "../../lib/utils";
import { ProgressPayload } from "../../types";

export const ProgressStrip: React.FC<{ progress: ProgressPayload | null }> = ({
  progress,
}) => {
  return (
    <div className="bg-[#18181b] border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-600 to-orange-400 animate-progress" />
      <div className="py-1.5 px-4 text-xs text-zinc-400 flex justify-between items-center">
        <div className="flex gap-4">
          <span>
            Files: <strong className="text-zinc-100">{progress ? progress.files.toLocaleString() : 0}</strong>
          </span>
          <span>
            Size: <strong className="text-zinc-100">{formatBytes(progress ? progress.bytes : 0)}</strong>
          </span>
          <span>
            Time: <strong className="text-zinc-100">{progress ? progress.elapsed_secs.toFixed(1) : "0.0"}s</strong>
          </span>
        </div>
        <div className="text-zinc-500 text-[11px]">Scanning directory…</div>
      </div>
    </div>
  );
};

export const StatusBar: React.FC<{
  totalBytes: number;
  totalFiles: number;
  durationSecs: number;
}> = ({ totalBytes, totalFiles, durationSecs }) => {
  return (
    <footer className="h-9 bg-[#131316] border-t border-white/5 px-4 text-[11px] text-zinc-500 flex items-center justify-between">
      <div className="flex gap-4">
        <span>
          Total: <strong className="text-zinc-300">{formatBytes(totalBytes)}</strong>
        </span>
        <span>
          Files: <strong className="text-zinc-300">{totalFiles.toLocaleString()}</strong>
        </span>
        <span>
          Duration: <strong className="text-zinc-300">{durationSecs.toFixed(2)}s</strong>
        </span>
      </div>
    </footer>
  );
};
