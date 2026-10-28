use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    /// Just the file/folder name (e.g. "Caches"), not the full path.
    /// Box<str> uses 16 bytes vs String's 24 bytes (drops the spare capacity).
    pub name: Box<str>,

    /// Allocated disk space in bytes (st_blocks * 512).
    pub size: u64,

    /// True if directory, false if file.
    pub is_dir: bool,

    /// Children of this directory. Empty for files.
    pub children: Vec<FileNode>,

    /// True if this directory or any child had unreadable items (permission errors).
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

    /// Recursively calculate and roll up folder sizes.
    /// A folder's total size = its own allocated size + all children sizes.
    pub fn roll_up_sizes(&mut self) -> u64 {
        if !self.is_dir {
            return self.size;
        }

        let children_total: u64 = self
            .children
            .iter_mut()
            .map(|child| child.roll_up_sizes())
            .sum();

        // Own folder entry size + sum of children
        self.size += children_total;

        // If any child is incomplete, this folder is marked incomplete
        if self.children.iter().any(|c| c.incomplete) {
            self.incomplete = true;
        }

        self.size
    }

    /// Sort children by size descending (largest first) recursively.
    pub fn sort_by_size_desc(&mut self) {
        if !self.is_dir {
            return;
        }
        self.children.sort_by(|a, b| b.size.cmp(&a.size));
        for child in &mut self.children {
            child.sort_by_size_desc();
        }
    }
}
