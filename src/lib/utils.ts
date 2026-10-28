export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  const val = (bytes / Math.pow(k, i)).toFixed(1);
  return `${val} ${sizes[i]}`;
}

export function truncateText(text: string, maxPixelWidth: number): string {
  const avgCharWidth = 7;
  const maxChars = Math.floor(maxPixelWidth / avgCharWidth);
  if (maxChars <= 3) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

export function getTileColor(
  name: string,
  depth: number,
  isAggregate: boolean
): { bg: string; border: string; text: string; subtext: string } {
  if (isAggregate) {
    return {
      bg: "#161619",
      border: "#232328",
      text: "#71717a",
      subtext: "#52525b",
    };
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);
  const hue = 22 + (posHash % 16);

  if (depth === 0) {
    const lightness = 13 + (posHash % 6);
    const saturation = 16 + (posHash % 10);
    return {
      bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      border: `hsla(${hue}, 38%, 32%, 0.45)`,
      text: "#f4f4f5",
      subtext: "#fdba74",
    };
  }

  const lightness = 9 + (posHash % 4);
  const saturation = 12 + (posHash % 8);
  return {
    bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    border: `hsla(${hue}, 30%, 24%, 0.35)`,
    text: "#e4e4e7",
    subtext: "#a1a1aa",
  };
}
