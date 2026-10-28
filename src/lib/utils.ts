export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  const val = (bytes / Math.pow(k, i)).toFixed(1);
  return `${val} ${sizes[i]}`;
}

export function getStableHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function getTileColor(
  name: string,
  depth: number,
  isAggregate: boolean,
  parentHue?: number
): { bg: string; border: string; text: string; hue: number } {
  if (isAggregate) {
    return {
      bg: "#27272a",
      border: "#3f3f46",
      text: "#a1a1aa",
      hue: 0,
    };
  }

  const hue = parentHue !== undefined ? parentHue : getStableHue(name);
  const lightness = depth === 0 ? 25 : depth === 1 ? 35 : 45;
  const borderLightness = depth === 0 ? 35 : depth === 1 ? 45 : 55;

  return {
    bg: `hsl(${hue}, 48%, ${lightness}%)`,
    border: `hsl(${hue}, 52%, ${borderLightness}%)`,
    text: "#ffffff",
    hue,
  };
}

export function truncateText(text: string, maxPixelWidth: number): string {
  const avgCharWidth = 7;
  const maxChars = Math.floor(maxPixelWidth / avgCharWidth);
  if (maxChars <= 3) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}
