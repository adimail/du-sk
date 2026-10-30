use crate::node::FileNode;
use crate::query::SearchResultItem;
use rayon::prelude::*;
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};
use std::sync::atomic::{AtomicU64, Ordering};

const NO_PARENT: u32 = u32::MAX;
const CHUNK_SIZE: usize = 1 << 16;
const CANCEL_CHECK_MASK: usize = 0x1FFF;

type Candidate = (u8, u64, u32);

struct IndexEntry {
    name_start: u32,
    end: u32,
    parent: u32,
    name_len: u16,
    is_dir: bool,
    size: u64,
}

pub struct SearchIndex {
    root_path: String,
    entries: Vec<IndexEntry>,
    lower_names: String,
    original_names: HashMap<u32, Box<str>>,
}

impl SearchIndex {
    pub fn build(root: &FileNode, root_path: &str) -> Self {
        let mut index = SearchIndex {
            root_path: root_path.trim_end_matches('/').to_string(),
            entries: Vec::new(),
            lower_names: String::new(),
            original_names: HashMap::new(),
        };
        let mut scratch = String::new();
        index.push_node(root, NO_PARENT, &mut scratch);
        index.entries.shrink_to_fit();
        index.lower_names.shrink_to_fit();
        index
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    fn push_node(&mut self, node: &FileNode, parent: u32, scratch: &mut String) {
        let idx = self.entries.len() as u32;

        scratch.clear();
        for ch in node.name.chars() {
            scratch.extend(ch.to_lowercase());
        }

        let name_start = self.lower_names.len() as u32;
        self.lower_names.push_str(scratch);

        if scratch.as_str() != &*node.name {
            self.original_names.insert(idx, node.name.clone());
        }

        self.entries.push(IndexEntry {
            name_start,
            end: 0,
            parent,
            name_len: u16::try_from(scratch.len()).unwrap_or(0),
            is_dir: node.is_dir,
            size: node.size,
        });

        for child in &node.children {
            self.push_node(child, idx, scratch);
        }

        let end = self.entries.len() as u32;
        self.entries[idx as usize].end = end;
    }

    fn lower_at(&self, idx: usize) -> &str {
        let entry = &self.entries[idx];
        let start = entry.name_start as usize;
        &self.lower_names[start..start + entry.name_len as usize]
    }

    fn name_at(&self, idx: u32) -> &str {
        if let Some(original) = self.original_names.get(&idx) {
            return original;
        }
        self.lower_at(idx as usize)
    }

    fn resolve(&self, segments: &[String]) -> Option<u32> {
        if self.entries.is_empty() {
            return None;
        }

        let remaining = match segments.first() {
            Some(first) if first.as_str() == self.name_at(0) => &segments[1..],
            _ => segments,
        };

        let mut current = 0u32;
        for segment in remaining {
            let end = self.entries[current as usize].end;
            let mut child = current + 1;
            let mut found = None;
            while child < end {
                if self.name_at(child) == segment.as_str() {
                    found = Some(child);
                    break;
                }
                child = self.entries[child as usize].end;
            }
            current = found?;
        }

        Some(current)
    }

    pub fn search(
        &self,
        base_segments: &[String],
        query: &str,
        limit: usize,
        latest: &AtomicU64,
        request_id: u64,
    ) -> Option<Vec<SearchResultItem>> {
        let base = match self.resolve(base_segments) {
            Some(base) => base,
            None => return Some(Vec::new()),
        };
        self.search_from(base, base_segments, query, limit, latest, request_id)
    }

    fn search_from(
        &self,
        base: u32,
        base_segments: &[String],
        query: &str,
        limit: usize,
        latest: &AtomicU64,
        request_id: u64,
    ) -> Option<Vec<SearchResultItem>> {
        let needle = query.trim().to_lowercase();
        if needle.is_empty() || limit == 0 {
            return Some(Vec::new());
        }

        let start = base as usize + 1;
        let end = self.entries[base as usize].end as usize;
        if start >= end {
            return Some(Vec::new());
        }

        let ranges: Vec<(usize, usize)> = (start..end)
            .step_by(CHUNK_SIZE)
            .map(|s| (s, (s + CHUNK_SIZE).min(end)))
            .collect();

        let partials: Option<Vec<Vec<Candidate>>> = ranges
            .par_iter()
            .map(|&(s, e)| self.scan_range(s, e, &needle, limit, latest, request_id))
            .collect();

        let mut merged: Vec<Candidate> = partials?.into_iter().flatten().collect();

        if latest.load(Ordering::Relaxed) != request_id {
            return None;
        }

        merged.sort_unstable_by(|a, b| b.cmp(a));
        merged.truncate(limit);

        Some(
            merged
                .into_iter()
                .map(|(_, _, idx)| self.build_result(base, idx, base_segments))
                .collect(),
        )
    }

    fn scan_range(
        &self,
        start: usize,
        end: usize,
        needle: &str,
        limit: usize,
        latest: &AtomicU64,
        request_id: u64,
    ) -> Option<Vec<Candidate>> {
        let mut heap: BinaryHeap<Reverse<Candidate>> = BinaryHeap::with_capacity(limit + 1);

        for i in start..end {
            if (i - start) & CANCEL_CHECK_MASK == 0 && latest.load(Ordering::Relaxed) != request_id
            {
                return None;
            }

            let name = self.lower_at(i);
            let tier = if name == needle {
                2
            } else if name.starts_with(needle) {
                1
            } else if name.contains(needle) {
                0
            } else {
                continue;
            };

            heap.push(Reverse((tier, self.entries[i].size, i as u32)));
            if heap.len() > limit {
                heap.pop();
            }
        }

        Some(heap.into_iter().map(|Reverse(c)| c).collect())
    }

    fn build_result(&self, base: u32, idx: u32, base_segments: &[String]) -> SearchResultItem {
        let mut relative: Vec<&str> = Vec::new();
        let mut current = idx;
        while current != base && current != NO_PARENT {
            relative.push(self.name_at(current));
            current = self.entries[current as usize].parent;
        }
        relative.reverse();

        let mut abs_parts: Vec<&str> = Vec::new();
        let mut full_scan = idx;
        while full_scan != 0 && full_scan != NO_PARENT {
            abs_parts.push(self.name_at(full_scan));
            full_scan = self.entries[full_scan as usize].parent;
        }
        abs_parts.reverse();

        let absolute_path = if abs_parts.is_empty() {
            self.root_path.clone()
        } else if self.root_path.is_empty() {
            format!("/{}", abs_parts.join("/"))
        } else {
            format!("{}/{}", self.root_path, abs_parts.join("/"))
        };

        let entry = &self.entries[idx as usize];
        let mut path_segments = base_segments.to_vec();
        path_segments.extend(relative.iter().map(|s| s.to_string()));

        SearchResultItem {
            name: self.name_at(idx).to_string(),
            path_segments,
            relative_path: relative.join("/"),
            absolute_path,
            size: entry.size,
            is_dir: entry.is_dir,
        }
    }
}

impl FileNode {
    pub fn search_subtree(
        &self,
        base_segments: &[String],
        query: &str,
        limit: usize,
    ) -> Vec<SearchResultItem> {
        let index = SearchIndex::build(self, "");
        let latest = AtomicU64::new(0);
        index
            .search_from(0, base_segments, query, limit, &latest, 0)
            .unwrap_or_default()
    }
}
