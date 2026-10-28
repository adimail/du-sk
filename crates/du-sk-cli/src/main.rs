use std::env;
use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

fn format_bytes(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    let b = bytes as f64;
    if b >= GB {
        format!("{:.1} GB", b / GB)
    } else if b >= MB {
        format!("{:.1} MB", b / MB)
    } else if b >= KB {
        format!("{:.1} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let target = if args.len() > 1 {
        PathBuf::from(&args[1])
    } else {
        dirs_target()
    };

    println!("Target: {}", target.display());

    let cancel = Arc::new(AtomicBool::new(false));
    let progress = Arc::new(du_sk_core::ScanProgress::default());

    let target_clone = target.clone();
    let cancel_clone = cancel.clone();
    let progress_clone = progress.clone();

    let start = Instant::now();

    let scan_handle = thread::spawn(move || {
        du_sk_core::scan_directory(&target_clone, cancel_clone, progress_clone)
    });

    while !scan_handle.is_finished() {
        let files = progress.files_scanned.load(Ordering::Relaxed);
        let bytes = progress.bytes_scanned.load(Ordering::Relaxed);
        let errors = progress.errors_count.load(Ordering::Relaxed);
        let elapsed = start.elapsed().as_secs_f64();

        print!(
            "\x1B[2K\rScanning... Files: {:>7} | Size: {:>9} | Errors: {} | Time: {:.1}s",
            files,
            format_bytes(bytes),
            errors,
            elapsed
        );
        let _ = io::stdout().flush();

        thread::sleep(Duration::from_millis(100));
    }

    print!("\x1B[2K\r");
    let _ = io::stdout().flush();

    match scan_handle.join().unwrap() {
        Ok(result) => {
            let duration = start.elapsed();
            println!("--- Scan Finished in {:.2?} ---", duration);
            println!("Total Size:  {}", format_bytes(result.total_bytes));
            println!("Total Files: {}", result.total_files);
            println!("Errors:      {}", result.unreadable_paths.len());

            println!("\nTop largest items in {}:", target.display());
            for child in result.root_node.children.iter().take(10) {
                let kind = if child.is_dir { "DIR " } else { "FILE" };
                println!(
                    "  [{}] {:<10} {}",
                    kind,
                    format_bytes(child.size),
                    child.name
                );
            }
        }
        Err(e) => {
            eprintln!("Scan failed: {}", e);
        }
    }
}

fn dirs_target() -> PathBuf {
    std::env::var("HOME")
        .map(|h| PathBuf::from(h).join("Library"))
        .unwrap_or_else(|_| PathBuf::from("."))
}
