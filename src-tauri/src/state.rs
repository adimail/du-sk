use du_sk_core::{ScanResult, SearchIndex};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub cancel_token: Arc<AtomicBool>,
    pub is_scanning: Arc<AtomicBool>,
    pub scan_result: Arc<Mutex<Option<Arc<ScanResult>>>>,
    pub search_index: Arc<Mutex<Option<Arc<SearchIndex>>>>,
    pub search_seq: Arc<AtomicU64>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            cancel_token: Arc::new(AtomicBool::new(false)),
            is_scanning: Arc::new(AtomicBool::new(false)),
            scan_result: Arc::new(Mutex::new(None)),
            search_index: Arc::new(Mutex::new(None)),
            search_seq: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
