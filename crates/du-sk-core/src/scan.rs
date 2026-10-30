use crate::node::FileNode;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskSpace {
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub mount_point: String,
    pub fs_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveBucketSnapshot {
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
}

pub struct TopLevelBucket {
    pub name: String,
    pub size: AtomicU64,
    pub is_dir: bool,
}

#[derive(Default)]
pub struct ScanProgress {
    pub files_scanned: AtomicU64,
    pub bytes_scanned: AtomicU64,
    pub errors_count: AtomicU64,
    pub buckets: Mutex<Vec<Arc<TopLevelBucket>>>,
    pub current_path: Mutex<String>,
}

impl ScanProgress {
    pub fn snapshot_buckets(&self) -> Vec<LiveBucketSnapshot> {
        if let Ok(lock) = self.buckets.lock() {
            lock.iter()
                .map(|b| LiveBucketSnapshot {
                    name: b.name.clone(),
                    size: b.size.load(Ordering::Relaxed),
                    is_dir: b.is_dir,
                })
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn set_current_path(&self, full_path: &str) {
        if let Ok(mut lock) = self.current_path.try_lock() {
            lock.clear();
            lock.push_str(full_path);
        }
    }

    pub fn get_current_path(&self) -> String {
        if let Ok(lock) = self.current_path.lock() {
            lock.clone()
        } else {
            String::new()
        }
    }
}

pub struct ScanResult {
    pub root_node: FileNode,
    pub unreadable_paths: Vec<PathBuf>,
    pub total_files: u64,
    pub total_bytes: u64,
    pub disk_space: Option<DiskSpace>,
}

struct ScanContext {
    root_dev: u64,
    cancel_token: Arc<AtomicBool>,
    progress: Arc<ScanProgress>,
    seen_inodes: Mutex<HashSet<(u64, u64)>>,
    unreadable_paths: Mutex<Vec<PathBuf>>,
}

#[cfg(target_os = "macos")]
fn extract_fs_info(stat: &libc::statfs) -> (String, String) {
    use std::ffi::CStr;
    let mount_point = unsafe {
        CStr::from_ptr(stat.f_mntonname.as_ptr())
            .to_string_lossy()
            .into_owned()
    };
    let fs_type = unsafe {
        CStr::from_ptr(stat.f_fstypename.as_ptr())
            .to_string_lossy()
            .to_uppercase()
    };
    (mount_point, fs_type)
}

pub fn get_disk_space(path: &Path) -> Option<DiskSpace> {
    use std::os::unix::ffi::OsStrExt;

    let c_path = std::ffi::CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut stat: libc::statfs = unsafe { std::mem::zeroed() };
    let res = unsafe { libc::statfs(c_path.as_ptr(), &mut stat) };
    if res != 0 {
        return None;
    }

    let bsize = stat.f_bsize as u64;
    let total_bytes = stat.f_blocks * bsize;
    let free_bytes = stat.f_bfree * bsize;
    let available_bytes = stat.f_bavail * bsize;
    let (mount_point, fs_type) = extract_fs_info(&stat);

    Some(DiskSpace {
        total_bytes,
        free_bytes,
        available_bytes,
        mount_point,
        fs_type,
    })
}

pub fn scan_directory(
    root_path: &Path,
    cancel_token: Arc<AtomicBool>,
    progress: Arc<ScanProgress>,
) -> Result<ScanResult, std::io::Error> {
    let root_meta = fs::symlink_metadata(root_path)?;
    if !root_meta.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Root path is not a directory",
        ));
    }

    let disk_space = get_disk_space(root_path);
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

    let mut root_node = FileNode::new_dir(&root_name);
    root_node.size = root_meta.blocks() * 512;

    let read_dir = match fs::read_dir(root_path) {
        Ok(rd) => rd,
        Err(err) => {
            if err.kind() == std::io::ErrorKind::PermissionDenied {
                root_node.incomplete = true;
                ctx.progress.errors_count.fetch_add(1, Ordering::Relaxed);
                if let Ok(mut paths) = ctx.unreadable_paths.lock() {
                    paths.push(root_path.to_path_buf());
                }
            }
            let unreadable_paths = ctx.unreadable_paths.lock().unwrap().clone();
            return Ok(ScanResult {
                root_node,
                unreadable_paths,
                total_files: 0,
                total_bytes: 0,
                disk_space,
            });
        }
    };

    let mut top_entries = Vec::new();
    for entry_res in read_dir {
        match entry_res {
            Ok(entry) => top_entries.push(entry),
            Err(err) => {
                if err.kind() == std::io::ErrorKind::PermissionDenied {
                    root_node.incomplete = true;
                    ctx.progress.errors_count.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
    }

    let mut bucket_pairs = Vec::new();
    {
        let mut buckets_lock = ctx.progress.buckets.lock().unwrap();
        for entry in top_entries {
            let path = entry.path();
            let is_dir = path.is_dir();
            let name = entry.file_name().to_string_lossy().to_string();
            let bucket = Arc::new(TopLevelBucket {
                name: name.clone(),
                size: AtomicU64::new(0),
                is_dir,
            });
            buckets_lock.push(bucket.clone());
            bucket_pairs.push((entry, bucket));
        }
    }

    let children: Vec<FileNode> = bucket_pairs
        .into_par_iter()
        .filter_map(|(entry, bucket)| {
            if ctx.cancel_token.load(Ordering::Relaxed) {
                return None;
            }

            let path = entry.path();
            let meta = match fs::symlink_metadata(&path) {
                Ok(m) => m,
                Err(err) => {
                    if err.kind() != std::io::ErrorKind::NotFound {
                        ctx.progress.errors_count.fetch_add(1, Ordering::Relaxed);
                        if let Ok(mut paths) = ctx.unreadable_paths.lock() {
                            paths.push(path);
                        }
                    }
                    return None;
                }
            };

            if meta.file_type().is_symlink() || meta.dev() != ctx.root_dev {
                return None;
            }

            let file_name = entry.file_name().to_string_lossy().to_string();
            ctx.progress.set_current_path(&path.to_string_lossy());

            if meta.is_dir() {
                let node = scan_dir_recursive(&path, &file_name, &ctx, Some(&bucket));
                Some(node)
            } else {
                let mut size = meta.blocks() * 512;
                if meta.nlink() > 1 {
                    let key = (meta.dev(), meta.ino());
                    let mut seen = ctx.seen_inodes.lock().unwrap();
                    if !seen.insert(key) {
                        size = 0;
                    }
                }

                bucket.size.fetch_add(size, Ordering::Relaxed);
                ctx.progress.files_scanned.fetch_add(1, Ordering::Relaxed);
                ctx.progress
                    .bytes_scanned
                    .fetch_add(size, Ordering::Relaxed);

                Some(FileNode::new_file(&file_name, size))
            }
        })
        .collect();

    root_node.children = children;
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
        disk_space,
    })
}

fn scan_dir_recursive(
    dir_path: &Path,
    name: &str,
    ctx: &Arc<ScanContext>,
    parent_bucket: Option<&Arc<TopLevelBucket>>,
) -> FileNode {
    let mut node = FileNode::new_dir(name);

    if let Ok(meta) = fs::symlink_metadata(dir_path) {
        let dir_block_size = meta.blocks() * 512;
        node.size = dir_block_size;
        if let Some(bucket) = parent_bucket {
            bucket.size.fetch_add(dir_block_size, Ordering::Relaxed);
        }
    }

    if ctx.cancel_token.load(Ordering::Relaxed) {
        return node;
    }

    let read_dir = match fs::read_dir(dir_path) {
        Ok(rd) => rd,
        Err(err) => {
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
                    if err.kind() != std::io::ErrorKind::NotFound {
                        ctx.progress.errors_count.fetch_add(1, Ordering::Relaxed);
                        if let Ok(mut paths) = ctx.unreadable_paths.lock() {
                            paths.push(path);
                        }
                    }
                    return None;
                }
            };

            if meta.file_type().is_symlink() || meta.dev() != ctx.root_dev {
                return None;
            }

            let file_name = entry.file_name().to_string_lossy().to_string();
            ctx.progress.set_current_path(&path.to_string_lossy());

            if meta.is_dir() {
                Some(scan_dir_recursive(&path, &file_name, ctx, parent_bucket))
            } else {
                let mut size = meta.blocks() * 512;
                if meta.nlink() > 1 {
                    let key = (meta.dev(), meta.ino());
                    let mut seen = ctx.seen_inodes.lock().unwrap();
                    if !seen.insert(key) {
                        size = 0;
                    }
                }

                if let Some(bucket) = parent_bucket {
                    bucket.size.fetch_add(size, Ordering::Relaxed);
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
