use serde::{Deserialize, Serialize};
use std::cmp::Reverse;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileNode {
    pub name: Box<str>,
    pub size: u64,
    pub file_count: u64,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
    pub incomplete: bool,
}

impl FileNode {
    pub fn new_file(name: &str, size: u64) -> Self {
        Self {
            name: name.into(),
            size,
            file_count: 1,
            is_dir: false,
            children: Vec::new(),
            incomplete: false,
        }
    }

    pub fn new_dir(name: &str) -> Self {
        Self {
            name: name.into(),
            size: 0,
            file_count: 0,
            is_dir: true,
            children: Vec::new(),
            incomplete: false,
        }
    }

    pub fn roll_up_sizes(&mut self) -> (u64, u64) {
        if !self.is_dir {
            return (self.size, self.file_count);
        }

        let (children_size, children_count): (Vec<u64>, Vec<u64>) = self
            .children
            .iter_mut()
            .map(|child| child.roll_up_sizes())
            .unzip();

        self.size += children_size.iter().sum::<u64>();
        self.file_count += children_count.iter().sum::<u64>();

        if self.children.iter().any(|c| c.incomplete) {
            self.incomplete = true;
        }

        (self.size, self.file_count)
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
