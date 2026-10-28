use crate::state::AppState;
use du_sk_core::{FolderViewResponse, LiveBucketSnapshot, ScanProgress, scan_directory};
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
pub struct ProgressPayload {
    pub files: u64,
    pub bytes: u64,
    pub errors: u64,
    pub elapsed_secs: f64,
    pub live_tiles: Vec<LiveBucketSnapshot>,
}

#[derive(Clone, Serialize)]
pub struct ScanCompletePayload {
    pub total_bytes: u64,
    pub total_files: u64,
    pub elapsed_secs: f64,
    pub unreadable_paths: Vec<String>,
    pub root_view: FolderViewResponse,
}

#[derive(Clone, Serialize)]
pub struct FolderPreset {
    pub label: String,
    pub path: String,
}

#[tauri::command]
pub fn get_default_target() -> String {
    std::env::var("HOME")
        .map(|h| {
            PathBuf::from(h)
                .join("Library")
                .to_string_lossy()
                .to_string()
        })
        .unwrap_or_else(|_| ".".into())
}

#[tauri::command]
pub fn get_folder_presets() -> Vec<FolderPreset> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let home_path = PathBuf::from(&home);
    vec![
        FolderPreset {
            label: "Home (~)".into(),
            path: home_path.to_string_lossy().to_string(),
        },
        FolderPreset {
            label: "Library".into(),
            path: home_path.join("Library").to_string_lossy().to_string(),
        },
        FolderPreset {
            label: "Downloads".into(),
            path: home_path.join("Downloads").to_string_lossy().to_string(),
        },
        FolderPreset {
            label: "Documents".into(),
            path: home_path.join("Documents").to_string_lossy().to_string(),
        },
        FolderPreset {
            label: "Desktop".into(),
            path: home_path.join("Desktop").to_string_lossy().to_string(),
        },
    ]
}

#[tauri::command]
pub fn pick_folder() -> Result<Option<String>, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg("POSIX path of (choose folder with prompt \"Select folder to scan:\")")
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, AppState>) {
    state.cancel_token.store(true, Ordering::Relaxed);
    state.is_scanning.store(false, Ordering::Relaxed);
    if let Ok(mut lock) = state.scan_result.lock() {
        *lock = None;
    }
}

#[tauri::command]
pub fn start_scan(
    app: AppHandle,
    state: State<'_, AppState>,
    target_path: Option<String>,
) -> Result<(), String> {
    if state
        .is_scanning
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("A scan is already in progress.".into());
    }

    let target = target_path
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(get_default_target()));

    if !target.exists() || !target.is_dir() {
        state.is_scanning.store(false, Ordering::Relaxed);
        return Err(format!(
            "Path is not a valid directory: {}",
            target.display()
        ));
    }

    state.cancel_token.store(false, Ordering::Relaxed);
    let cancel = state.cancel_token.clone();
    let progress = Arc::new(ScanProgress::default());

    let scan_result_slot = state.scan_result.clone();
    let is_scanning_flag = state.is_scanning.clone();

    let target_clone = target.clone();
    let cancel_worker = cancel.clone();
    let progress_worker = progress.clone();

    let scan_handle =
        thread::spawn(move || scan_directory(&target_clone, cancel_worker, progress_worker));

    thread::spawn(move || {
        let start = Instant::now();

        while !scan_handle.is_finished() {
            if cancel.load(Ordering::Relaxed) {
                break;
            }

            let files = progress.files_scanned.load(Ordering::Relaxed);
            let bytes = progress.bytes_scanned.load(Ordering::Relaxed);
            let errors = progress.errors_count.load(Ordering::Relaxed);
            let elapsed_secs = start.elapsed().as_secs_f64();
            let live_tiles = progress.snapshot_buckets();

            let _ = app.emit(
                "scan-progress",
                ProgressPayload {
                    files,
                    bytes,
                    errors,
                    elapsed_secs,
                    live_tiles,
                },
            );

            thread::sleep(Duration::from_millis(200));
        }

        is_scanning_flag.store(false, Ordering::Relaxed);

        if cancel.load(Ordering::Relaxed) {
            let _ = app.emit("scan-cancelled", ());
            return;
        }

        match scan_handle.join() {
            Ok(Ok(result)) => {
                let elapsed_secs = start.elapsed().as_secs_f64();
                let unreadable_strings: Vec<String> = result
                    .unreadable_paths
                    .iter()
                    .take(100)
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();

                let root_name = result.root_node.name.to_string();
                let root_view = result.root_node.to_folder_view(vec![root_name]);

                let complete_payload = ScanCompletePayload {
                    total_bytes: result.total_bytes,
                    total_files: result.total_files,
                    elapsed_secs,
                    unreadable_paths: unreadable_strings,
                    root_view,
                };

                if let Ok(mut slot) = scan_result_slot.lock() {
                    *slot = Some(result);
                }

                let _ = app.emit("scan-complete", complete_payload);
            }
            Ok(Err(err)) => {
                let _ = app.emit("scan-error", err.to_string());
            }
            Err(_) => {
                let _ = app.emit("scan-error", "Scanner thread panicked".to_string());
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn get_folder_children(
    state: State<'_, AppState>,
    path_segments: Vec<String>,
) -> Result<FolderViewResponse, String> {
    let slot = state.scan_result.lock().map_err(|e| e.to_string())?;
    let scan_res = slot.as_ref().ok_or("No scan data available")?;

    let seg_slices: Vec<&str> = path_segments.iter().map(|s| s.as_str()).collect();

    let node = scan_res
        .root_node
        .find_node_by_path(&seg_slices)
        .ok_or_else(|| format!("Path not found: {:?}", path_segments))?;

    Ok(node.to_folder_view(path_segments))
}
