use crate::node::FileNode;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BinaryHeap;

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

struct ScoredSearchCandidate<'a> {
    tier: u8,
    size: u64,
    node: &'a FileNode,
    path_len: usize,
}

impl<'a> PartialEq for ScoredSearchCandidate<'a> {
    fn eq(&self, other: &Self) -> bool {
        self.tier == other.tier && self.size == other.size
    }
}

impl<'a> Eq for ScoredSearchCandidate<'a> {}

impl<'a> Ord for ScoredSearchCandidate<'a> {
    fn cmp(&self, other: &Self) -> Ordering {
        match self.tier.cmp(&other.tier) {
            Ordering::Equal => self.size.cmp(&other.size),
            ord => ord,
        }
    }
}

impl<'a> PartialOrd for ScoredSearchCandidate<'a> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
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

    pub fn search_subtree(
        &self,
        base_segments: &[String],
        query: &str,
        limit: usize,
    ) -> Vec<SearchResultItem> {
        let trimmed_query = query.trim();
        if trimmed_query.is_empty() || limit == 0 {
            return Vec::new();
        }

        let q_lower = trimmed_query.to_lowercase();
        let mut heap: BinaryHeap<std::cmp::Reverse<ScoredSearchCandidate>> =
            BinaryHeap::with_capacity(limit + 1);

        let mut stack: Vec<(&FileNode, usize, bool)> = Vec::with_capacity(64);
        let mut path_crumbs: Vec<&str> = Vec::with_capacity(64);

        for child in &self.children {
            stack.push((child, 0, false));
        }

        while let Some((node, depth, processed)) = stack.pop() {
            if processed {
                path_crumbs.truncate(depth);
                continue;
            }

            path_crumbs.truncate(depth);
            path_crumbs.push(&node.name);

            let is_ascii = node.name.is_ascii() && q_lower.is_ascii();
            let (matched, tier) = if is_ascii {
                let name_bytes = node.name.as_bytes();
                let q_bytes = q_lower.as_bytes();
                if name_bytes.eq_ignore_ascii_case(q_bytes) {
                    (true, 2)
                } else if name_bytes.strip_prefix(q_bytes).is_some_and(|_| true)
                    || (name_bytes.len() >= q_bytes.len()
                        && name_bytes[..q_bytes.len()].eq_ignore_ascii_case(q_bytes))
                {
                    (true, 1)
                } else {
                    let mut found = false;
                    if name_bytes.len() >= q_bytes.len() {
                        for window in name_bytes.windows(q_bytes.len()) {
                            if window.eq_ignore_ascii_case(q_bytes) {
                                found = true;
                                break;
                            }
                        }
                    }
                    (found, 0)
                }
            } else {
                let lower = node.name.to_lowercase();
                if lower == q_lower {
                    (true, 2)
                } else if lower.starts_with(&q_lower) {
                    (true, 1)
                } else if lower.contains(&q_lower) {
                    (true, 0)
                } else {
                    (false, 0)
                }
            };

            if matched {
                let candidate = ScoredSearchCandidate {
                    tier,
                    size: node.size,
                    node,
                    path_len: path_crumbs.len(),
                };

                heap.push(std::cmp::Reverse(candidate));
                if heap.len() > limit {
                    heap.pop();
                }
            }

            if node.is_dir && !node.children.is_empty() {
                stack.push((node, depth, true));
                for child in node.children.iter().rev() {
                    stack.push((child, depth + 1, false));
                }
            }
        }

        let mut ordered_candidates = Vec::with_capacity(heap.len());
        while let Some(std::cmp::Reverse(cand)) = heap.pop() {
            ordered_candidates.push(cand);
        }
        ordered_candidates.reverse();

        ordered_candidates
            .into_iter()
            .map(|cand| {
                let mut path_segments = base_segments.to_vec();
                let mut rel_segments = Vec::with_capacity(cand.path_len);

                let mut cur = self;
                'outer: for _ in 0..cand.path_len {
                    for child in &cur.children {
                        if child.find_node_by_pointer(cand.node) {
                            path_segments.push(child.name.to_string());
                            rel_segments.push(child.name.as_ref());
                            cur = child;
                            continue 'outer;
                        }
                    }
                    break;
                }

                let relative_path = if rel_segments.is_empty() {
                    cand.node.name.to_string()
                } else {
                    rel_segments.join("/")
                };

                SearchResultItem {
                    name: cand.node.name.to_string(),
                    path_segments,
                    relative_path,
                    size: cand.node.size,
                    is_dir: cand.node.is_dir,
                }
            })
            .collect()
    }

    fn find_node_by_pointer(&self, target: &FileNode) -> bool {
        if std::ptr::eq(self, target) {
            return true;
        }
        if !self.is_dir {
            return false;
        }
        for child in &self.children {
            if child.find_node_by_pointer(target) {
                return true;
            }
        }
        false
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
