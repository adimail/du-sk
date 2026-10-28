import React from "react";
import { formatBytes } from "../../lib/utils";
import { ProgressPayload } from "../../types";

export const ProgressStrip: React.FC<{ progress: ProgressPayload | null }> = ({
  progress,
}) => {
  return (
    <div
      style={{
        background: "#18181b",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background:
            "linear-gradient(90deg, transparent, #ea580c, #fb923c, transparent)",
          animation: "progress-indeterminate 1.5s infinite ease-in-out",
        }}
      />
      <div
        style={{
          padding: "6px 16px",
          fontSize: "12px",
          color: "#a1a1aa",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "16px" }}>
          <span>
            Files: <strong style={{ color: "#f4f4f5" }}>{progress ? progress.files.toLocaleString() : 0}</strong>
          </span>
          <span>
            Size: <strong style={{ color: "#f4f4f5" }}>{formatBytes(progress ? progress.bytes : 0)}</strong>
          </span>
          <span>
            Time: <strong style={{ color: "#f4f4f5" }}>{progress ? progress.elapsed_secs.toFixed(1) : "0.0"}s</strong>
          </span>
        </div>
        <div style={{ color: "#71717a", fontSize: "11px" }}>Scanning directory…</div>
      </div>
      <style>{`
        @keyframes progress-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export const StatusBar: React.FC<{
  totalBytes: number;
  totalFiles: number;
  durationSecs: number;
}> = ({ totalBytes, totalFiles, durationSecs }) => {
  return (
    <footer
      style={{
        height: "36px",
        background: "#131316",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        padding: "0 16px",
        fontSize: "11px",
        color: "#71717a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", gap: "16px" }}>
        <span>
          Total: <strong style={{ color: "#e4e4e7" }}>{formatBytes(totalBytes)}</strong>
        </span>
        <span>
          Files: <strong style={{ color: "#e4e4e7" }}>{totalFiles.toLocaleString()}</strong>
        </span>
        <span>
          Duration: <strong style={{ color: "#e4e4e7" }}>{durationSecs.toFixed(2)}s</strong>
        </span>
      </div>
    </footer>
  );
};
