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

  // FR-7: Share of parent calculation
  const share = parentSize > 0 ? (item.size / parentSize) * 100 : 0;
  const shareText = share < 0.1 ? "<0.1%" : `${share.toFixed(1)}%`;

  // Clamp tooltip inside window bounds so it never clips off-screen
  const tooltipWidth = 240;
  const tooltipHeight = 90;
  const padding = 12;

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
        background: "rgba(22, 22, 26, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "6px",
        padding: "8px 12px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
        fontSize: "12px",
        lineHeight: "1.5",
        color: "#f3f3f3",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginBottom: "4px",
        }}
      >
        {item.name}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", color: "#a0a0aa" }}>
        <span>Size:</span>
        <span style={{ color: "#fff", fontWeight: 500 }}>{formatBytes(item.size)}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", color: "#a0a0aa" }}>
        <span>Share:</span>
        <span style={{ color: "#fff", fontWeight: 500 }}>{shareText}</span>
      </div>

      {item.incomplete && (
        <div style={{ color: "#f87171", marginTop: "4px", fontWeight: 500 }}>
          ⚠️ Incomplete (unreadable items)
        </div>
      )}

      {item.is_aggregate && (
        <div style={{ color: "#9ca3af", marginTop: "2px", fontStyle: "italic" }}>
          Group of {item.aggregate_count} smaller items
        </div>
      )}
    </div>
  );
};
