use crate::node::FileNode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TileItem {
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub incomplete: bool,
    pub is_aggregate: bool,
    pub aggregate_count: usize,
    pub children: Vec<TileItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FolderViewResponse {
    pub current_path: Vec<String>,
    pub total_size: u64,
    pub incomplete: bool,
    pub tiles: Vec<TileItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchResultItem {
    pub name: String,
    pub path_segments: Vec<String>,
    pub relative_path: String,
    pub size: u64,
    pub is_dir: bool,
}

const MERGE_THRESHOLD_RATIO: f64 = 0.005;

impl FileNode {
    pub fn find_node_by_path(&self, path_segments: &[&str]) -> Option<&FileNode> {
        if path_segments.is_empty() {
            return Some(self);
        }

        let segments = if path_segments[0] == self.name.as_ref() {
            &path_segments[1..]
        } else {
            path_segments
        };

        let mut current = self;
        for &seg in segments {
            current = current
                .children
                .iter()
                .find(|child| child.name.as_ref() == seg)?;
        }
        Some(current)
    }

    pub fn to_folder_view(&self, current_path: Vec<String>) -> FolderViewResponse {
        let threshold = (self.size as f64 * MERGE_THRESHOLD_RATIO) as u64;
        let tiles = aggregate_children(&self.children, threshold, true);

        FolderViewResponse {
            current_path,
            total_size: self.size,
            incomplete: self.incomplete,
            tiles,
        }
    }
}

fn aggregate_children(nodes: &[FileNode], threshold: u64, include_level2: bool) -> Vec<TileItem> {
    let mut large_items: Vec<TileItem> = Vec::new();
    let mut small_items_size: u64 = 0;
    let mut small_items_count: usize = 0;

    for node in nodes {
        if node.size == 0 {
            continue;
        }

        if node.size < threshold {
            small_items_size += node.size;
            small_items_count += 1;
        } else {
            let level2_children = if include_level2 && node.is_dir {
                let child_threshold = (node.size as f64 * MERGE_THRESHOLD_RATIO) as u64;
                aggregate_children(&node.children, child_threshold, false)
            } else {
                Vec::new()
            };

            large_items.push(TileItem {
                name: node.name.to_string(),
                size: node.size,
                is_dir: node.is_dir,
                incomplete: node.incomplete,
                is_aggregate: false,
                aggregate_count: 0,
                children: level2_children,
            });
        }
    }

    if small_items_count > 0 {
        large_items.push(TileItem {
            name: format!("{} smaller items", small_items_count),
            size: small_items_size,
            is_dir: false,
            incomplete: false,
            is_aggregate: true,
            aggregate_count: small_items_count,
            children: Vec::new(),
        });
    }

    large_items
}
