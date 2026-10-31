use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const MAX_RECENTS: usize = 8;
const RECENTS_FILE: &str = "recents.json";

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct RecentPath {
    pub path: String,
    pub label: String,
    pub last_used: u64,
}

fn get_recents_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join(RECENTS_FILE))
}

pub fn load_recents(app: &tauri::AppHandle) -> Vec<RecentPath> {
    let file_path = match get_recents_file_path(app) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    if !file_path.exists() {
        return Vec::new();
    }

    let data = match fs::read_to_string(&file_path) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    let entries: Vec<RecentPath> = serde_json::from_str(&data).unwrap_or_default();
    entries
        .into_iter()
        .filter(|e| Path::new(&e.path).is_dir())
        .collect()
}

pub fn save_recents(app: &tauri::AppHandle, recents: &[RecentPath]) -> Result<(), String> {
    let file_path = get_recents_file_path(app)?;
    let serialized = serde_json::to_string_pretty(recents).map_err(|e| e.to_string())?;
    fs::write(file_path, serialized).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_recent(app: &tauri::AppHandle, path: &Path) {
    let canonical = match fs::canonicalize(path) {
        Ok(c) => c,
        Err(_) => path.to_path_buf(),
    };

    let path_str = canonical.to_string_lossy().to_string();
    let label = canonical
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| path_str.clone());

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut existing = load_recents(app);
    existing.retain(|item| item.path != path_str);

    existing.insert(
        0,
        RecentPath {
            path: path_str,
            label,
            last_used: now,
        },
    );

    if existing.len() > MAX_RECENTS {
        existing.truncate(MAX_RECENTS);
    }

    let _ = save_recents(app, &existing);
}

pub fn clear_recents(app: &tauri::AppHandle) -> Result<(), String> {
    save_recents(app, &[])
}
