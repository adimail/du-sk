import React, { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderPreset } from "../types";

interface FolderSelectorProps {
  currentPath: string | null;
  onSelectPath: (path: string) => void;
  disabled?: boolean;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  currentPath,
  onSelectPath,
  disabled = false,
}) => {
  const [presets, setPresets] = useState<FolderPreset[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<FolderPreset[]>("get_folder_presets")
      .then(setPresets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayTargetName = useMemo(() => {
    if (currentPath) {
      const matched = presets.find((p) => p.path === currentPath);
      if (matched) return matched.label;
      const parts = currentPath.replace(/\/$/, "").split("/");
      return parts[parts.length - 1] || currentPath;
    }
    return "Library";
  }, [currentPath, presets]);

  async function handlePickCustomFolder() {
    setDropdownOpen(false);
    try {
      const chosen = await invoke<string | null>("pick_folder");
      if (chosen) {
        onSelectPath(chosen);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleSelectPreset(presetPath: string) {
    setDropdownOpen(false);
    onSelectPath(presetPath);
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-zinc-100 py-1 px-2.5 rounded-full text-xs font-medium cursor-pointer hover:bg-white/10 disabled:opacity-50 disabled:cursor-default transition-colors"
      >
        <span>{displayTargetName}</span>
        <span className="text-[9px] text-zinc-400">▼</span>
      </button>

      {dropdownOpen && (
        <div className="absolute top-8 left-0 z-50 bg-[#16161b] border border-white/10 rounded-xl p-1.5 min-w-[170px] shadow-2xl">
          {presets.map((preset) => (
            <button
              key={preset.path}
              type="button"
              onClick={() => handleSelectPreset(preset.path)}
              className={`w-full text-left border-none py-1.5 px-2.5 rounded-md text-xs cursor-pointer transition-colors ${
                currentPath === preset.path
                  ? "bg-orange-500/15 text-orange-400 font-medium"
                  : "bg-transparent text-zinc-300 hover:bg-white/5"
              }`}
            >
              {preset.label}
            </button>
          ))}

          <div className="h-px bg-white/10 my-1" />

          <button
            type="button"
            onClick={handlePickCustomFolder}
            className="w-full text-left bg-transparent border-none text-zinc-100 py-1.5 px-2.5 rounded-md text-xs font-medium cursor-pointer hover:bg-white/5 transition-colors"
          >
            Choose Folder…
          </button>
        </div>
      )}
    </div>
  );
};
