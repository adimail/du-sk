import React, { useState } from "react";
import { formatBytes } from "../../lib/utils";
import { ProgressPayload } from "../../types";

export const ProgressStrip: React.FC<{ progress: ProgressPayload | null }> = ({
  progress,
}) => {
  if (!progress) {
    return (
      <div style={{ padding: "8px 16px", background: "#1f1f23", fontSize: "12px", color: "#9ca3af" }}>
        Starting scan…
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#18181b",
        borderBottom: "1px solid #27272a",
        padding: "6px 16px",
        fontSize: "12px",
        color: "#d4d4d8",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", gap: "16px" }}>
        <span>Files: <strong>{progress.files.toLocaleString()}</strong></span>
        <span>Size: <strong>{formatBytes(progress.bytes)}</strong></span>
        <span>Time: <strong>{progress.elapsed_secs.toFixed(1)}s</strong></span>
        {progress.errors > 0 && (
          <span style={{ color: "#f87171" }}>
            Errors: <strong>{progress.errors}</strong>
          </span>
        )}
      </div>
      <div style={{ color: "#a1a1aa", fontStyle: "italic" }}>Scanning in progress…</div>
    </div>
  );
};

export const WarningBanner: React.FC<{ unreadablePaths: string[] }> = ({
  unreadablePaths,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (unreadablePaths.length === 0) return null;

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
          ⚠️ <strong>{unreadablePaths.length} items</strong> could not be read. Totals are incomplete.
          Grant <em>Full Disk Access</em> in macOS System Settings → Privacy & Security.
        </span>
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
          {expanded ? "Hide paths" : "View paths"}
        </button>
      </div>

      {expanded && (
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
