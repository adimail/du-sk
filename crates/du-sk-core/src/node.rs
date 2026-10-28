use serde::{Deserialize, Serialize};
use std::cmp::Reverse;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: Box<str>,
    pub size: u64,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
    pub incomplete: bool,
}

impl FileNode {
    pub fn new_file(name: &str, size: u64) -> Self {
        Self {
            name: name.into(),
            size,
            is_dir: false,
            children: Vec::new(),
            incomplete: false,
        }
    }

    pub fn new_dir(name: &str) -> Self {
        Self {
            name: name.into(),
            size: 0,
            is_dir: true,
            children: Vec::new(),
            incomplete: false,
        }
    }

    pub fn roll_up_sizes(&mut self) -> u64 {
        if !self.is_dir {
            return self.size;
        }

        let children_total: u64 = self
            .children
            .iter_mut()
            .map(|child| child.roll_up_sizes())
            .sum();

        self.size += children_total;

        if self.children.iter().any(|c| c.incomplete) {
            self.incomplete = true;
        }

        self.size
    }

    pub fn sort_by_size_desc(&mut self) {
        if !self.is_dir {
            return;
        }
        self.children.sort_by_key(|a| Reverse(a.size));
        for child in &mut self.children {
            child.sort_by_size_desc();
        }
    }
}
