export interface TileItem {
  name: string;
  size: number;
  is_dir: boolean;
  incomplete: boolean;
  is_aggregate: boolean;
  aggregate_count: number;
  children: TileItem[];
}

export interface FolderViewResponse {
  current_path: string[];
  total_size: number;
  incomplete: boolean;
  tiles: TileItem[];
}

export interface ProgressPayload {
  files: number;
  bytes: number;
  errors: number;
  elapsed_secs: number;
}

export interface ScanCompletePayload {
  total_bytes: number;
  total_files: number;
  elapsed_secs: number;
  unreadable_paths: string[];
  root_view: FolderViewResponse;
}

export type ScanStatus = "idle" | "scanning" | "complete" | "cancelled" | "error";
