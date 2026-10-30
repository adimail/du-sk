pub mod index;
pub mod node;
pub mod query;
pub mod scan;

pub use index::SearchIndex;
pub use node::FileNode;
pub use query::{FolderViewResponse, SearchResultItem, TileItem};
pub use scan::{
    get_disk_space, scan_directory, DiskSpace, LiveBucketSnapshot, ScanProgress, ScanResult,
};

pub fn version() -> &'static str {
    "0.1.0"
}
