import React, { useRef, useState, useEffect, useMemo } from "react";
import * as d3 from "d3-hierarchy";
import type { HierarchyRectangularNode } from "d3-hierarchy";
import { TileItem } from "../../types";
import { formatBytes, getTileColor } from "../../lib/utils";
import { Tooltip } from "./Tooltip";

interface TreemapProps {
  tiles: TileItem[];
  totalSize: number;
  onDrillDown: (folderName: string) => void;
  canDrill: boolean;
}

interface HoverState {
  item: TileItem;
  parentSize: number;
  x: number;
  y: number;
}

export const Treemap: React.FC<TreemapProps> = ({
  tiles,
  totalSize,
  onDrillDown,
  canDrill,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute D3 Squarified Treemap layout typed as HierarchyRectangularNode
  const layout = useMemo((): HierarchyRectangularNode<TileItem>[] => {
    if (dimensions.width === 0 || dimensions.height === 0 || tiles.length === 0) {
      return [];
    }

    const rootData: TileItem = {
      name: "root",
      size: totalSize,
      is_dir: true,
      incomplete: false,
      is_aggregate: false,
      aggregate_count: 0,
      children: tiles,
    };

    const root = d3
      .hierarchy<TileItem>(rootData)
      .sum((d) => (d.children && d.children.length > 0 ? 0 : d.size))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3
      .treemap<TileItem>()
      .size([dimensions.width, dimensions.height])
      .paddingInner(1)
      .round(true);

    const laidOutRoot = treemap(root);
    return (laidOutRoot.children || []) as HierarchyRectangularNode<TileItem>[];
  }, [tiles, totalSize, dimensions]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#121214",
      }}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: "block" }}
      >
        {layout.map((node, i) => {
          const item = node.data;
          const w = node.x1 - node.x0;
          const h = node.y1 - node.y0;

          if (w <= 0 || h <= 0) return null;

          const color = getTileColor(item.name, 0, item.is_aggregate);

          // FR-4: Label only shown if tile is at least 48px wide and 18px tall
          const showLabel = w >= 48 && h >= 18;
          const isClickable = canDrill && item.is_dir && !item.is_aggregate;

          return (
            <g
              key={`${item.name}-${i}`}
              transform={`translate(${node.x0}, ${node.y0})`}
              style={{ cursor: isClickable ? "pointer" : "default" }}
              onClick={() => {
                if (isClickable) onDrillDown(item.name);
              }}
              onMouseMove={(e) => {
                setHover({
                  item,
                  parentSize: totalSize,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
            >
              {/* Tile rectangle */}
              <rect
                width={w}
                height={h}
                fill={color.bg}
                stroke={color.border}
                strokeWidth={1}
                rx={2}
              />

              {/* Incomplete indicator marker */}
              {item.incomplete && w >= 24 && h >= 24 && (
                <text
                  x={w - 14}
                  y={16}
                  fontSize={12}
                  fill="#f87171"
                  textAnchor="middle"
                >
                  ⚠️
                </text>
              )}

              {/* Tile label (Name and Size) */}
              {showLabel && (
                <g transform="translate(6, 14)">
                  <text
                    fontSize={11}
                    fontWeight={600}
                    fill="#ffffff"
                    style={{
                      userSelect: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </text>
                  {h >= 32 && (
                    <text
                      y={14}
                      fontSize={10}
                      fill="rgba(255, 255, 255, 0.75)"
                      style={{ userSelect: "none" }}
                    >
                      {formatBytes(item.size)}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hover && (
        <Tooltip
          item={hover.item}
          parentSize={hover.parentSize}
          x={hover.x}
          y={hover.y}
        />
      )}
    </div>
  );
};
