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
): {
  bg: string;
  border: string;
  text: string;
  badgeText: string;
  badgeBg: string;
  badgeBorder: string;
} {
  if (isAggregate) {
    return {
      bg: "#131316",
      border: "rgba(255, 255, 255, 0.06)",
      text: "#71717a",
      badgeText: "#71717a",
      badgeBg: "rgba(255, 255, 255, 0.04)",
      badgeBorder: "rgba(255, 255, 255, 0.06)",
    };
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);

  const graphiteShades = [
    "#16161b",
    "#18181f",
    "#1b1b23",
    "#171921",
    "#1d1c24",
    "#161820",
    "#1a1922",
  ];

  if (depth === 0) {
    const bg = graphiteShades[posHash % graphiteShades.length];
    return {
      bg,
      border: "rgba(255, 255, 255, 0.09)",
      text: "#ffffff",
      badgeText: "#fb923c",
      badgeBg: "rgba(251, 146, 60, 0.12)",
      badgeBorder: "rgba(251, 146, 60, 0.22)",
    };
  }

  const subShades = [
    "#101014",
    "#121217",
    "#131319",
    "#111218",
  ];
  const bg = subShades[posHash % subShades.length];
  return {
    bg,
    border: "rgba(255, 255, 255, 0.05)",
    text: "#d4d4d8",
    badgeText: "#a1a1aa",
    badgeBg: "rgba(255, 255, 255, 0.04)",
    badgeBorder: "rgba(255, 255, 255, 0.06)",
  };
}
