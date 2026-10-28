use du_sk_core::ScanResult;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub scan_result: Arc<Mutex<Option<ScanResult>>>,
    pub cancel_token: Arc<AtomicBool>,
    pub is_scanning: Arc<AtomicBool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            scan_result: Arc::new(Mutex::new(None)),
            cancel_token: Arc::new(AtomicBool::new(false)),
            is_scanning: Arc::new(AtomicBool::new(false)),
        }
    }
}
