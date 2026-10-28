use crate::node::FileNode;
use rayon::prelude::*;
use std::collections::HashSet;
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

/// Progress stats accumulated live during scan.
#[derive(Debug, Default)]
pub struct ScanProgress {
    pub files_scanned: AtomicU64,
    pub bytes_scanned: AtomicU64,
    pub errors_count: AtomicU64,
}

/// Final summary result of a scan.
pub struct ScanResult {
    pub root_node: FileNode,
    pub unreadable_paths: Vec<PathBuf>,
    pub total_files: u64,
    pub total_bytes: u64,
}

struct ScanContext {
    root_dev: u64,
    cancel_token: Arc<AtomicBool>,
    progress: Arc<ScanProgress>,
    seen_inodes: Mutex<HashSet<(u64, u64)>>, // (dev, ino)
    unreadable_paths: Mutex<Vec<PathBuf>>,
}

pub fn scan_directory(
    root_path: &Path,
    cancel_token: Arc<AtomicBool>,
    progress: Arc<ScanProgress>,
) -> Result<ScanResult, std::io::Error> {
    // 1. Stat root directory to obtain root device ID
    let root_meta = fs::symlink_metadata(root_path)?;
    if !root_meta.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Root path is not a directory",
        ));
    }

    let root_dev = root_meta.dev();
    let ctx = Arc::new(ScanContext {
        root_dev,
        cancel_token,
        progress,
        seen_inodes: Mutex::new(HashSet::new()),
        unreadable_paths: Mutex::new(Vec::new()),
    });

    let root_name = root_path
        .file_name()
        .map(|s| s.to_string_lossy())
        .unwrap_or_else(|| "/".into());

    let mut root_node = scan_dir_recursive(root_path, &root_name, &ctx);

    // Roll up all sizes and sort descending
    root_node.roll_up_sizes();
    root_node.sort_by_size_desc();

    let unreadable_paths = ctx.unreadable_paths.lock().unwrap().clone();
    let total_files = ctx.progress.files_scanned.load(Ordering::Relaxed);
    let total_bytes = root_node.size;

    Ok(ScanResult {
        root_node,
        unreadable_paths,
        total_files,
        total_bytes,
    })
}

fn scan_dir_recursive(dir_path: &Path, name: &str, ctx: &Arc<ScanContext>) -> FileNode {
    let mut node = FileNode::new_dir(name);

    if ctx.cancel_token.load(Ordering::Relaxed) {
        return node;
    }

    let read_dir = match fs::read_dir(dir_path) {
        Ok(rd) => rd,
        Err(err) => {
            // Permission denied or unreadable folder
            if err.kind() == std::io::ErrorKind::PermissionDenied {
                node.incomplete = true;
                ctx.progress.errors_count.fetch_add(1, Ordering::Relaxed);
                if let Ok(mut paths) = ctx.unreadable_paths.lock() {
                    paths.push(dir_path.to_path_buf());
                }
            }
            return node;
        }
    };

    // Collect directory entries
    let mut entries = Vec::new();
    for entry_res in read_dir {
        match entry_res {
            Ok(entry) => entries.push(entry),
            Err(err) => {
                if err.kind() == std::io::ErrorKind::PermissionDenied {
                    node.incomplete = true;
                    ctx.progress.errors_count.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
    }

    // Process entries in parallel with Rayon
    let children: Vec<FileNode> = entries
        .into_par_iter()
        .filter_map(|entry| {
            if ctx.cancel_token.load(Ordering::Relaxed) {
                return None;
            }

            let path = entry.path();
            let meta = match fs::symlink_metadata(&path) {
                Ok(m) => m,
                Err(err) => {
                    // Ignore files that vanished during scan
                    if err.kind() != std::io::ErrorKind::NotFound {
                        ctx.progress.errors_count.fetch_add(1, Ordering::Relaxed);
                        if let Ok(mut paths) = ctx.unreadable_paths.lock() {
                            paths.push(path);
                        }
                    }
                    return None;
                }
            };

            // Skip symlinks entirely
            if meta.file_type().is_symlink() {
                return None;
            }

            // Skip entries crossing onto another mounted volume
            if meta.dev() != ctx.root_dev {
                return None;
            }

            let file_name = entry.file_name().to_string_lossy().to_string();

            if meta.is_dir() {
                Some(scan_dir_recursive(&path, &file_name, ctx))
            } else {
                // Handle hard links: if nlink > 1, check if seen
                let mut size = meta.blocks() * 512;
                if meta.nlink() > 1 {
                    let key = (meta.dev(), meta.ino());
                    let mut seen = ctx.seen_inodes.lock().unwrap();
                    if !seen.insert(key) {
                        size = 0; // Already counted previously
                    }
                }

                ctx.progress.files_scanned.fetch_add(1, Ordering::Relaxed);
                ctx.progress
                    .bytes_scanned
                    .fetch_add(size, Ordering::Relaxed);

                Some(FileNode::new_file(&file_name, size))
            }
        })
        .collect();

    node.children = children;
    node
}
