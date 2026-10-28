/**
 * FR-2: 1024-based formatting with 1 decimal place, 0 B has no decimal.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  const val = (bytes / Math.pow(k, i)).toFixed(1);
  return `${val} ${sizes[i]}`;
}

/**
 * FR-5: Hash a folder name to a stable hue (0 - 360).
 * Same folder name always yields the exact same hue across scans.
 */
export function getStableHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

/**
 * Generate HSL color for a tile.
 * - Aggregate tiles are neutral grey.
 * - Level 0 children get base hue.
 * - Nested Level 1 children get lighter shades of that hue.
 */
export function getTileColor(
  name: string,
  depth: number,
  isAggregate: boolean,
  parentHue?: number
): { bg: string; border: string; text: string; hue: number } {
  if (isAggregate) {
    return {
      bg: "#2a2a2e",
      border: "#3a3a40",
      text: "#a0a0aa",
      hue: 0,
    };
  }

  const hue = parentHue !== undefined ? parentHue : getStableHue(name);

  // Depth 0 (direct children of current folder): darker base
  // Depth 1 (grandchildren): lighter tint
  const lightness = depth === 0 ? 28 : 38;
  const borderLightness = depth === 0 ? 38 : 48;

  return {
    bg: `hsl(${hue}, 50%, ${lightness}%)`,
    border: `hsl(${hue}, 55%, ${borderLightness}%)`,
    text: "#ffffff",
    hue,
  };
}
