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

export interface LiveBucket {
  name: string;
  size: number;
  is_dir: boolean;
}

export interface ProgressPayload {
  files: number;
  bytes: number;
  errors: number;
  elapsed_secs: number;
  live_tiles: LiveBucket[];
}

export interface DiskSpace {
  total_bytes: number;
  free_bytes: number;
  available_bytes: number;
  mount_point: string;
  fs_type: string;
}

export interface ScanCompletePayload {
  total_bytes: number;
  total_files: number;
  elapsed_secs: number;
  unreadable_paths: string[];
  root_view: FolderViewResponse;
  scanned_path: string;
  disk_space: DiskSpace | null;
}

export interface FolderPreset {
  label: string;
  path: string;
}

export interface RecentPath {
  path: string;
  label: string;
  last_used: number;
}

export interface SearchResultItem {
  name: string;
  path_segments: string[];
  relative_path: string;
  absolute_path: string;
  size: number;
  is_dir: boolean;
}

export interface HoveredTileInfo {
  name: string;
  size: number;
}

export type ScanStatus = "idle" | "scanning" | "complete" | "cancelled" | "error";

export interface ScanState {
  status: ScanStatus;
  progress: ProgressPayload | null;
  view: FolderViewResponse | null;
  totalFiles: number;
  rootTotalBytes: number;
  duration: number;
  diskSpace: DiskSpace | null;
  error: string | null;
}
