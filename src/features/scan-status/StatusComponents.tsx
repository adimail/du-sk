import React, { useState } from "react";
import { formatBytes } from "../../lib/utils";
import { ProgressPayload } from "../../types";

export const ProgressStrip: React.FC<{ progress: ProgressPayload | null }> = ({
  progress,
}) => {
  return (
    <div
      style={{
        background: "#18181b",
        borderBottom: "1px solid #27272a",
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
          background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
          animation: "progress-indeterminate 1.5s infinite ease-in-out",
        }}
      />
      <div
        style={{
          padding: "6px 16px",
          fontSize: "12px",
          color: "#d4d4d8",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "16px" }}>
          <span>
            Files: <strong>{progress ? progress.files.toLocaleString() : 0}</strong>
          </span>
          <span>
            Size: <strong>{formatBytes(progress ? progress.bytes : 0)}</strong>
          </span>
          <span>
            Time: <strong>{progress ? progress.elapsed_secs.toFixed(1) : "0.0"}s</strong>
          </span>
          {progress && progress.errors > 0 && (
            <span style={{ color: "#f87171" }}>
              Errors: <strong>{progress.errors}</strong>
            </span>
          )}
        </div>
        <div style={{ color: "#a1a1aa", fontStyle: "italic" }}>Scanning in progress…</div>
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

export const WarningBanner: React.FC<{
  errorCount: number;
  unreadablePaths: string[];
}> = ({ errorCount, unreadablePaths }) => {
  const [expanded, setExpanded] = useState(false);

  if (errorCount === 0) return null;

  return (
    <div
      style={{
        background: "#451a1a",
        borderBottom: "1px solid #7f1d1d",
        color: "#fecaca",
        padding: "8px 16px",
        fontSize: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          ⚠️ <strong>{errorCount} items</strong> could not be read. Totals are incomplete.
          Grant Full Disk Access in macOS System Settings → Privacy & Security.
        </span>
        {unreadablePaths.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            {expanded ? "Hide paths" : `View paths (${unreadablePaths.length})`}
          </button>
        )}
      </div>

      {expanded && unreadablePaths.length > 0 && (
        <div
          style={{
            marginTop: "8px",
            maxHeight: "120px",
            overflowY: "auto",
            background: "#2b1111",
            padding: "6px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          {unreadablePaths.map((path, i) => (
            <div key={i} style={{ color: "#fca5a5", marginBottom: "2px" }}>
              {path}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const StatusBar: React.FC<{
  totalBytes: number;
  totalFiles: number;
  durationSecs: number;
  errorCount: number;
}> = ({ totalBytes, totalFiles, durationSecs, errorCount }) => {
  return (
    <div
      style={{
        background: "#18181b",
        borderTop: "1px solid #27272a",
        padding: "6px 16px",
        fontSize: "12px",
        color: "#a1a1aa",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", gap: "16px" }}>
        <span>Total: <strong>{formatBytes(totalBytes)}</strong></span>
        <span>Files: <strong>{totalFiles.toLocaleString()}</strong></span>
        <span>Duration: <strong>{durationSecs.toFixed(2)}s</strong></span>
      </div>
      {errorCount > 0 && (
        <span style={{ color: "#f87171" }}>
          Unreadable: {errorCount}
        </span>
      )}
    </div>
  );
};
