use crate::node::FileNode;
use serde::{Deserialize, Serialize};

const MIN_CULPRIT_BYTES: u64 = 10 * 1024 * 1024;
const MIN_CULPRIT_RATIO: f64 = 0.01;
const DOMINANCE_RATIO: f64 = 0.80;

const ACTIONABLE_TERMINAL_DIRS: &[&str] = &[
    "target",
    "node_modules",
    ".git",
    "cache",
    "caches",
    ".cache",
    "venv",
    ".venv",
    "env",
    ".next",
    ".nuxt",
    "build",
    "dist",
    "out",
    "vendor",
    "pods",
    ".gradle",
    ".cargo",
    "deriveddata",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FolderCulprit {
    pub name: String,
    pub relative_path: String,
    pub size: u64,
    pub percentage: f64,
}

pub fn find_top_culprits(root: &FileNode, total_bytes: u64, limit: usize) -> Vec<FolderCulprit> {
    if limit == 0 || total_bytes == 0 {
        return Vec::new();
    }

    let min_size_threshold = if total_bytes < MIN_CULPRIT_BYTES {
        (total_bytes as f64 * MIN_CULPRIT_RATIO) as u64
    } else {
        MIN_CULPRIT_BYTES.max((total_bytes as f64 * MIN_CULPRIT_RATIO) as u64)
    };

    let mut raw_candidates: Vec<(String, String, u64)> = Vec::new();

    for child in &root.children {
        if child.is_dir && child.size >= min_size_threshold {
            let mut path_stack = vec![child.name.as_ref()];
            resolve_culprit_branch(
                child,
                &mut path_stack,
                min_size_threshold,
                &mut raw_candidates,
            );
        }
    }

    raw_candidates.sort_unstable_by_key(|a| std::cmp::Reverse(a.2));

    let mut selected: Vec<(String, String, u64)> = Vec::new();
    for candidate in raw_candidates {
        let overlaps = selected.iter().any(|s| {
            candidate.1 == s.1
                || candidate.1.starts_with(&format!("{}/", s.1))
                || s.1.starts_with(&format!("{}/", candidate.1))
        });

        if !overlaps {
            selected.push(candidate);
            if selected.len() >= limit {
                break;
            }
        }
    }

    selected
        .into_iter()
        .map(|(name, relative_path, size)| {
            let percentage = (size as f64 / total_bytes as f64) * 100.0;
            FolderCulprit {
                name,
                relative_path,
                size,
                percentage,
            }
        })
        .collect()
}

fn is_terminal_boundary(name: &str) -> bool {
    let lower = name.to_lowercase();
    ACTIONABLE_TERMINAL_DIRS.iter().any(|&term| term == lower)
}

fn resolve_culprit_branch<'a>(
    node: &'a FileNode,
    path_stack: &mut Vec<&'a str>,
    min_size_threshold: u64,
    candidates: &mut Vec<(String, String, u64)>,
) {
    if is_terminal_boundary(node.name.as_ref()) {
        candidates.push((node.name.to_string(), path_stack.join("/"), node.size));
        return;
    }

    let dominant_child = node
        .children
        .iter()
        .find(|c| c.is_dir && c.size >= (node.size as f64 * DOMINANCE_RATIO) as u64);

    if let Some(child) = dominant_child {
        path_stack.push(child.name.as_ref());
        resolve_culprit_branch(child, path_stack, min_size_threshold, candidates);
        path_stack.pop();
    } else {
        candidates.push((node.name.to_string(), path_stack.join("/"), node.size));

        for child in &node.children {
            if child.is_dir
                && child.size >= min_size_threshold
                && is_terminal_boundary(child.name.as_ref())
            {
                path_stack.push(child.name.as_ref());
                candidates.push((child.name.to_string(), path_stack.join("/"), child.size));
                path_stack.pop();
            }
        }
    }
}
