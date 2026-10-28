import React from "react";
import { TileItem } from "../../types";
import { formatBytes } from "../../lib/utils";

interface TooltipProps {
  item: TileItem | null;
  parentSize: number;
  x: number;
  y: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ item, parentSize, x, y }) => {
  if (!item) return null;

  const share = parentSize > 0 ? (item.size / parentSize) * 100 : 0;
  const shareText = share < 0.1 ? "<0.1%" : `${share.toFixed(1)}%`;

  const tooltipWidth = 220;
  const tooltipHeight = item.incomplete ? 96 : 78;
  const padding = 14;

  let left = x + padding;
  let top = y + padding;

  if (left + tooltipWidth > window.innerWidth) {
    left = x - tooltipWidth - padding;
  }
  if (top + tooltipHeight > window.innerHeight) {
    top = y - tooltipHeight - padding;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${tooltipWidth}px`,
        pointerEvents: "none",
        zIndex: 9999,
        background: "rgba(24, 24, 27, 0.94)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "10px",
        padding: "10px 14px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.6)",
        fontSize: "12px",
        color: "#f4f4f5",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginBottom: "6px",
          color: "#fafafa",
        }}
      >
        {item.name}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#a1a1aa",
          marginBottom: "3px",
        }}
      >
        <span>Size</span>
        <span style={{ color: "#fb923c", fontWeight: 500 }}>
          {formatBytes(item.size)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#a1a1aa",
        }}
      >
        <span>Share</span>
        <span style={{ color: "#f4f4f5", fontWeight: 500 }}>{shareText}</span>
      </div>

      {item.incomplete && (
        <div
          style={{
            marginTop: "6px",
            paddingTop: "6px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#fb923c",
            fontSize: "10px",
            fontWeight: 500,
          }}
        >
          Contains unreadable items
        </div>
      )}
    </div>
  );
};
