import React, { useRef, useState, useEffect, useMemo } from "react";
import * as d3 from "d3-hierarchy";
import type { HierarchyRectangularNode } from "d3-hierarchy";
import { HoveredTileInfo, TileItem } from "../types";
import { formatBytes, getTileColor, truncateText } from "../lib/utils";

interface TreemapProps {
  tiles: TileItem[];
  totalSize: number;
  onDrillDown: (folderName: string) => void;
  canDrill: boolean;
  onHoverTile?: (item: HoveredTileInfo | null) => void;
}

interface NestedChildLayout {
  item: TileItem;
  x0: number;
  y0: number;
  w: number;
  h: number;
}

export const Treemap: React.FC<TreemapProps> = ({
  tiles,
  totalSize,
  onDrillDown,
  canDrill,
  onHoverTile,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredTileIndex, setHoveredTileIndex] = useState<number | null>(null);
  const [hoveredSubTileKey, setHoveredSubTileKey] = useState<string | null>(null);

  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        setViewBox({ x: 0, y: 0, w: width, h: height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      setViewBox({ x: 0, y: 0, w: dimensions.width, h: dimensions.height });
      setIsZooming(false);
      setHoveredTileIndex(null);
      setHoveredSubTileKey(null);
      if (onHoverTile) onHoverTile(null);
    }
  }, [tiles, dimensions, onHoverTile]);

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
      .paddingInner(3)
      .paddingOuter(2)
      .round(true);

    const laidOutRoot = treemap(root);
    return (laidOutRoot.children || []) as HierarchyRectangularNode<TileItem>[];
  }, [tiles, totalSize, dimensions]);

  const nestedLayouts = useMemo(() => {
    const map = new Map<number, NestedChildLayout[]>();

    layout.forEach((node, idx) => {
      const item = node.data;
      const w = Math.max(0, node.x1 - node.x0);
      const h = Math.max(0, node.y1 - node.y0);

      if (!item.is_dir || !item.children || item.children.length === 0 || w < 50 || h < 40) {
        return;
      }

      const innerRootData: TileItem = {
        name: "subroot",
        size: item.size,
        is_dir: true,
        incomplete: false,
        is_aggregate: false,
        aggregate_count: 0,
        children: item.children,
      };

      const innerRoot = d3
        .hierarchy<TileItem>(innerRootData)
        .sum((d) => (d.children && d.children.length > 0 ? 0 : Math.max(d.size, 1)))
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      const innerTreemap = d3
        .treemap<TileItem>()
        .size([w - 8, h - 28])
        .paddingInner(2)
        .round(true);

      const laidOutInner = innerTreemap(innerRoot);
      const childLayouts: NestedChildLayout[] = (laidOutInner.children || []).map((c) => ({
        item: c.data,
        x0: c.x0 + 4,
        y0: c.y0 + 24,
        w: Math.max(0, c.x1 - c.x0),
        h: Math.max(0, c.y1 - c.y0),
      }));

      map.set(idx, childLayouts);
    });

    return map;
  }, [layout]);

  function triggerZoomAndDrill(node: HierarchyRectangularNode<TileItem>) {
    if (isZooming || !canDrill || !node.data.is_dir || node.data.is_aggregate) return;

    setIsZooming(true);
    const startX = viewBox ? viewBox.x : 0;
    const startY = viewBox ? viewBox.y : 0;
    const startW = viewBox ? viewBox.w : dimensions.width;
    const startH = viewBox ? viewBox.h : dimensions.height;

    const targetX = node.x0;
    const targetY = node.y0;
    const targetW = Math.max(node.x1 - node.x0, 1);
    const targetH = Math.max(node.y1 - node.y0, 1);

    const startTime = performance.now();
    const duration = 280;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = 1 - Math.pow(1 - progress, 3);

      const curX = startX + (targetX - startX) * ease;
      const curY = startY + (targetY - startY) * ease;
      const curW = startW + (targetW - startW) * ease;
      const curH = startH + (targetH - startH) * ease;

      setViewBox({ x: curX, y: curY, w: curW, h: curH });

      if (progress < 1.0) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        onDrillDown(node.data.name);
      }
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = requestAnimationFrame(animate);
  }

  if (tiles.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs bg-[#0e0e11] rounded-lg border border-white/5">
        Empty directory
      </div>
    );
  }

  const currentVb = viewBox || { x: 0, y: 0, w: dimensions.width, h: dimensions.height };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#0e0e11] rounded-lg"
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`${currentVb.x} ${currentVb.y} ${currentVb.w} ${currentVb.h}`}
        preserveAspectRatio="none"
        className={`block w-full h-full ${isZooming ? "pointer-events-none" : ""}`}
      >
        {layout.map((node, i) => {
          const item = node.data;
          const w = Math.max(0, node.x1 - node.x0);
          const h = Math.max(0, node.y1 - node.y0);

          if (w <= 0 || h <= 0) return null;

          const color = getTileColor(item.name, 0, item.is_aggregate);
          const isClickable = canDrill && item.is_dir && !item.is_aggregate;
          const isTileHovered = hoveredTileIndex === i && !hoveredSubTileKey;
          const isGroupHovered = hoveredTileIndex === i;

          const showHeader = w >= 45 && h >= 20;
          const showBadge = w >= 130 && h >= 26;
          const sizeString = formatBytes(item.size);
          const badgeWidth = sizeString.length * 7 + 14;
          const titleMaxWidth = showBadge ? w - badgeWidth - 20 : w - 16;

          const innerTiles = nestedLayouts.get(i) || [];

          return (
            <g
              key={`${item.name}-${i}`}
              transform={`translate(${node.x0}, ${node.y0})`}
              tabIndex={isClickable ? 0 : -1}
              className={`outline-none ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              onMouseEnter={() => {
                setHoveredTileIndex(i);
                if (onHoverTile) onHoverTile({ name: item.name, size: item.size });
              }}
              onMouseLeave={() => {
                setHoveredTileIndex((cur) => (cur === i ? null : cur));
                setHoveredSubTileKey(null);
                if (onHoverTile) onHoverTile(null);
              }}
              onClick={() => {
                if (isClickable) triggerZoomAndDrill(node);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isClickable) {
                  triggerZoomAndDrill(node);
                }
              }}
            >
              <rect
                width={w}
                height={h}
                fill={color.bg}
                stroke={isTileHovered ? "rgba(251, 146, 60, 0.5)" : color.border}
                strokeWidth={isTileHovered ? 1.5 : 1}
                rx={6}
                className="transition-colors duration-150"
              />

              {showHeader && (
                <g transform="translate(8, 5)">
                  <text
                    y={12}
                    fontSize={11}
                    fontWeight={600}
                    fill={color.text}
                    className="select-none"
                  >
                    {truncateText(item.name, titleMaxWidth)}
                  </text>

                  {showBadge && (
                    <g transform={`translate(${w - badgeWidth - 16}, 0)`}>
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

                  {!showBadge && h >= 38 && (
                    <text
                      y={24}
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

              {innerTiles.length > 0 && (
                <g>
                  {innerTiles.map((child, cIdx) => {
                    const childKey = `${i}-${child.item.name}-${cIdx}`;
                    const isSubHovered = hoveredSubTileKey === childKey;

                    const childOpacity = isSubHovered
                      ? 0.95
                      : isGroupHovered
                      ? 0.28
                      : 0.0;

                    const showChildLabel = child.w >= 36 && child.h >= 14 && isGroupHovered;

                    return (
                      <g
                        key={childKey}
                        transform={`translate(${child.x0}, ${child.y0})`}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredSubTileKey(childKey);
                          if (onHoverTile) onHoverTile({ name: child.item.name, size: child.item.size });
                        }}
                        onMouseLeave={(e) => {
                          e.stopPropagation();
                          setHoveredSubTileKey(null);
                          if (onHoverTile) onHoverTile({ name: item.name, size: item.size });
                        }}
                      >
                        <rect
                          width={child.w}
                          height={child.h}
                          fill={isSubHovered ? "#27272a" : "#18181b"}
                          fillOpacity={childOpacity}
                          stroke={isSubHovered ? "rgba(251, 146, 60, 0.7)" : "rgba(255, 255, 255, 0.12)"}
                          strokeOpacity={childOpacity}
                          strokeWidth={isSubHovered ? 1.5 : 1}
                          rx={4}
                          className="transition-[fill-opacity,stroke-opacity,fill] duration-150"
                        />
                        {showChildLabel && (
                          <text
                            x={4}
                            y={Math.min(child.h / 2 + 3.5, 12)}
                            fontSize={9}
                            fontWeight={isSubHovered ? 600 : 400}
                            fill={isSubHovered ? "#ffffff" : "rgba(255, 255, 255, 0.75)"}
                            opacity={isSubHovered ? 1 : 0.6}
                            className="select-none pointer-events-none"
                          >
                            {truncateText(child.item.name, child.w - 8)}
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
    </div>
  );
};
