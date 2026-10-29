import React, { memo } from "react";
import { formatBytes } from "../lib/utils";
import { SearchResultItem } from "../types";

interface SearchResultRowProps {
  item: SearchResultItem;
  index: number;
  isSelected: boolean;
  query: string;
  onSelect: (index: number, reveal: boolean) => void;
  onHover: (index: number) => void;
}

function highlight(name: string, query: string): React.ReactNode {
  const needle = query.trim().toLowerCase();
  if (!needle) return name;

  const lower = name.toLowerCase();
  if (lower.length !== name.length) return name;

  const at = lower.indexOf(needle);
  if (at < 0) return name;

  const stop = at + needle.length;
  return (
    <>
      {name.slice(0, at)}
      <span className="text-orange-400">{name.slice(at, stop)}</span>
      {name.slice(stop)}
    </>
  );
}

function formatPath(relativePath: string): string {
  const parts = relativePath.split("/");
  if (parts.length <= 3) return relativePath;
  return `${parts[0]}/…/${parts.slice(-2).join("/")}`;
}

function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-orange-400 flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-zinc-500 flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export const SearchResultRow = memo(function SearchResultRow({
  item,
  index,
  isSelected,
  query,
  onSelect,
  onHover,
}: SearchResultRowProps) {
  return (
    <button
      type="button"
      data-index={index}
      onClick={(e) => onSelect(index, e.metaKey || e.ctrlKey)}
      onMouseMove={() => onHover(index)}
      title={item.relative_path}
      className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 text-xs border-none cursor-pointer transition-colors ${
        isSelected
          ? "bg-orange-500/15 text-orange-200"
          : "bg-transparent text-zinc-300"
      }`}
    >
      {item.is_dir ? <FolderIcon /> : <FileIcon />}
      <div className="min-w-0 flex-1 flex flex-col">
        <span className="truncate font-medium">
          {highlight(item.name, query)}
        </span>
        <span className="text-[10px] text-zinc-500 truncate mt-0.5">
          {formatPath(item.relative_path)}
        </span>
      </div>
      <span className="w-20 text-right text-[10px] text-zinc-400 font-mono flex-shrink-0">
        {formatBytes(item.size)}
      </span>
    </button>
  );
});
