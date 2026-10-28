import React, { useRef, useState, useEffect, useMemo } from "react";
import * as d3 from "d3-hierarchy";
import type { HierarchyRectangularNode } from "d3-hierarchy";
import { TileItem } from "../../types";
import { formatBytes, getTileColor, truncateText } from "../../lib/utils";

interface TreemapProps {
  tiles: TileItem[];
  totalSize: number;
  onDrillDown: (folderName: string) => void;
  canDrill: boolean;
}

export const Treemap: React.FC<TreemapProps> = ({
  tiles,
  totalSize,
  onDrillDown,
  canDrill,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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
      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs bg-[#0e0e11] rounded-xl border border-white/5">
        Empty directory
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#0e0e11] rounded-xl"
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="block"
      >
        {layout.map((node, i) => {
          const item = node.data;
          const w = Math.max(0, node.x1 - node.x0);
          const h = Math.max(0, node.y1 - node.y0);

          if (w <= 0 || h <= 0) return null;

          const color = getTileColor(item.name, 0, item.is_aggregate);
          const isClickable = canDrill && item.is_dir && !item.is_aggregate;

          const showHeader = w >= 50 && h >= 22;
          const showBadge = w >= 130 && h >= 28;
          const sizeString = formatBytes(item.size);
          const badgeWidth = sizeString.length * 7 + 14;
          const titleMaxWidth = showBadge ? w - badgeWidth - 20 : w - 16;

          return (
            <g
              key={`${item.name}-${i}`}
              transform={`translate(${node.x0}, ${node.y0})`}
              tabIndex={isClickable ? 0 : -1}
              className={`outline-none transition-transform duration-200 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              onClick={() => {
                if (isClickable) onDrillDown(item.name);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isClickable) {
                  onDrillDown(item.name);
                }
              }}
            >
              <rect
                width={w}
                height={h}
                fill={color.bg}
                stroke={color.border}
                strokeWidth={1}
                rx={6}
                className="transition-[width,height] duration-200"
              />

              {showHeader && (
                <g transform="translate(8, 6)">
                  <text
                    y={13}
                    fontSize={11}
                    fontWeight={600}
                    fill={color.text}
                    className="select-none"
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
                        className="select-none"
                      >
                        {sizeString}
                      </text>
                    </g>
                  )}

                  {!showBadge && h >= 40 && (
                    <text
                      y={26}
                      fontSize={10}
                      fontWeight={500}
                      fill={color.badgeText}
                      className="select-none"
                    >
                      {sizeString}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
