import React, { useRef, useState, useEffect, useMemo } from "react";
import * as d3 from "d3-hierarchy";
import type { HierarchyRectangularNode } from "d3-hierarchy";
import { TileItem } from "../../types";
import { formatBytes, getTileColor, truncateText } from "../../lib/utils";
import { Tooltip } from "./Tooltip";

interface TreemapProps {
  tiles: TileItem[];
  totalSize: number;
  onDrillDown: (folderName: string) => void;
  canDrill: boolean;
  isScanning?: boolean;
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
  isScanning = false,
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

  const layout = useMemo((): HierarchyRectangularNode<TileItem>[] => {
    if (dimensions.width === 0 || dimensions.height === 0 || tiles.length === 0) {
      return [];
    }

    const effectiveTotal = Math.max(
      totalSize,
      tiles.reduce((acc, t) => acc + t.size, 0)
    );

    const rootData: TileItem = {
      name: "root",
      size: effectiveTotal,
      is_dir: true,
      incomplete: false,
      is_aggregate: false,
      aggregate_count: 0,
      children: tiles,
    };

    const root = d3
      .hierarchy<TileItem>(rootData)
      .sum((d) => (d.children && d.children.length > 0 ? 0 : Math.max(d.size, 1)))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3
      .treemap<TileItem>()
      .size([dimensions.width, dimensions.height])
      .paddingInner(4)
      .round(true);

    const laidOutRoot = treemap(root);
    return (laidOutRoot.children || []) as HierarchyRectangularNode<TileItem>[];
  }, [tiles, totalSize, dimensions]);

  if (tiles.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#71717a",
          fontSize: "13px",
          backgroundColor: "#0e0e11",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        Empty directory
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#0e0e11",
        borderRadius: "12px",
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
          const w = Math.max(0, node.x1 - node.x0);
          const h = Math.max(0, node.y1 - node.y0);

          if (w <= 0 || h <= 0) return null;

          const color = getTileColor(item.name, 0, item.is_aggregate);
          const isClickable = canDrill && item.is_dir && !item.is_aggregate;

          const hasSubChildren = item.children && item.children.length > 0;
          const canRenderSubTreemap = !isScanning && hasSubChildren && w >= 90 && h >= 68;
          const headerHeight = h >= 32 && w >= 60 ? 28 : 0;

          const showHeader = w >= 50 && h >= 22;
          const showBadge = w >= 130 && h >= 28;
          const sizeString = formatBytes(item.size);
          const badgeWidth = sizeString.length * 7 + 14;
          const titleMaxWidth = showBadge ? w - badgeWidth - 20 : w - 16;

          let subLayout: HierarchyRectangularNode<TileItem>[] = [];
          if (canRenderSubTreemap) {
            const subRootData: TileItem = {
              name: item.name,
              size: item.size,
              is_dir: true,
              incomplete: false,
              is_aggregate: false,
              aggregate_count: 0,
              children: item.children,
            };

            const subRoot = d3
              .hierarchy<TileItem>(subRootData)
              .sum((d) => d.size)
              .sort((a, b) => (b.value || 0) - (a.value || 0));

            const subTreemap = d3
              .treemap<TileItem>()
              .size([w - 8, h - headerHeight - 8])
              .paddingInner(2)
              .round(true);

            const laidOutSub = subTreemap(subRoot);
            subLayout = (laidOutSub.children || []) as HierarchyRectangularNode<TileItem>[];
          }

          return (
            <g
              key={`${item.name}-${i}`}
              transform={`translate(${node.x0}, ${node.y0})`}
              tabIndex={isClickable ? 0 : -1}
              style={{
                cursor: isClickable ? "pointer" : "default",
                outline: "none",
                transition: "transform 0.2s ease-out",
              }}
              onClick={() => {
                if (isClickable) onDrillDown(item.name);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isClickable) {
                  onDrillDown(item.name);
                }
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
              <rect
                width={w}
                height={h}
                fill={color.bg}
                stroke={color.border}
                strokeWidth={1}
                rx={6}
                style={{
                  transition: "width 0.2s ease-out, height 0.2s ease-out",
                }}
              />

              {showHeader && (
                <g transform="translate(8, 6)">
                  <text
                    y={13}
                    fontSize={11}
                    fontWeight={600}
                    fill={color.text}
                    style={{ userSelect: "none" }}
                  >
                    {truncateText(item.name, titleMaxWidth)}
                  </text>

                  {showBadge && (
                    <g transform={`translate(${w - badgeWidth - 16}, 1)`}>
                      <rect
                        width={badgeWidth}
                        height={16}
                        fill={color.badgeBg}
                        stroke={color.badgeBorder}
                        strokeWidth={1}
                        rx={8}
                      />
                      <text
                        x={badgeWidth / 2}
                        y={11}
                        fontSize={9}
                        fontWeight={600}
                        fill={color.badgeText}
                        textAnchor="middle"
                        style={{ userSelect: "none" }}
                      >
                        {sizeString}
                      </text>
                    </g>
                  )}

                  {!showBadge && h >= 40 && !canRenderSubTreemap && (
                    <text
                      y={26}
                      fontSize={10}
                      fontWeight={500}
                      fill={color.badgeText}
                      style={{ userSelect: "none" }}
                    >
                      {sizeString}
                    </text>
                  )}
                </g>
              )}

              {canRenderSubTreemap && (
                <g transform={`translate(4, ${headerHeight + 4})`}>
                  {subLayout.map((subNode, subIdx) => {
                    const subItem = subNode.data;
                    const sw = Math.max(0, subNode.x1 - subNode.x0);
                    const sh = Math.max(0, subNode.y1 - subNode.y0);

                    if (sw <= 0 || sh <= 0) return null;

                    const subColor = getTileColor(subItem.name, 1, subItem.is_aggregate);
                    const showSubLabel = sw >= 36 && sh >= 16;

                    return (
                      <g
                        key={`sub-${subItem.name}-${subIdx}`}
                        transform={`translate(${subNode.x0}, ${subNode.y0})`}
                        style={{
                          transition: "transform 0.2s ease-out",
                        }}
                        onMouseMove={(e) => {
                          e.stopPropagation();
                          setHover({
                            item: subItem,
                            parentSize: item.size,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      >
                        <rect
                          width={sw}
                          height={sh}
                          fill={subColor.bg}
                          stroke={subColor.border}
                          strokeWidth={1}
                          rx={3}
                          style={{
                            transition: "width 0.2s ease-out, height 0.2s ease-out",
                          }}
                        />
                        {showSubLabel && (
                          <text
                            x={4}
                            y={11}
                            fontSize={9}
                            fontWeight={500}
                            fill="#d4d4d8"
                            style={{ userSelect: "none" }}
                          >
                            {truncateText(subItem.name, sw - 8)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
      </svg>

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
