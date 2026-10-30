import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderPreset } from "../types";

interface WelcomeScreenProps {
  onSelectPath: (path: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectPath }) => {
  const [presets, setPresets] = useState<FolderPreset[]>([]);

  useEffect(() => {
    invoke<FolderPreset[]>("get_folder_presets")
      .then(setPresets)
      .catch(() => {});
  }, []);

  async function handlePickCustomFolder() {
    try {
      const chosen = await open({
        directory: true,
        multiple: false,
        title: "Select folder to scan",
      });
      if (typeof chosen === "string") {
        onSelectPath(chosen);
      }
    } catch {}
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 select-none">
      <div className="max-w-xl w-full flex flex-col items-center">
        <h1 className="text-xl font-semibold text-zinc-100 mb-1 tracking-tight">Select Target to Scan</h1>
        <p className="text-xs text-zinc-400 mb-8 text-center max-w-sm">
          Choose a directory preset below or browse for any custom folder.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
          {presets.map((preset) => (
            <button
              key={preset.path}
              type="button"
              onClick={() => onSelectPath(preset.path)}
              className="flex flex-col items-start p-3 hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-lg transition-colors cursor-pointer text-left"
            >
              <span className="text-xs font-medium text-zinc-200">{preset.label}</span>
              <span className="text-[10px] text-zinc-500 truncate w-full mt-0.5">{preset.path}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={handlePickCustomFolder}
            className="flex flex-col items-start p-3 hover:bg-white/5 border border-dashed border-white/20 hover:border-white/30 rounded-lg transition-colors cursor-pointer text-left"
          >
            <span className="text-xs font-medium text-zinc-200">Choose Folder…</span>
            <span className="text-[10px] text-zinc-500 truncate w-full mt-0.5">Select custom path</span>
          </button>
        </div>
      </div>
    </div>
  );
};
