pub mod node;
pub mod scan;

pub use node::FileNode;
pub use scan::{scan_directory, ScanProgress, ScanResult};

pub fn version() -> &'static str {
    "0.1.0"
}
