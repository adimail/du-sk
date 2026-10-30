mod args;
mod format;
mod render;
mod terminal;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

fn main() {
    let cli_args = match args::parse_args() {
        Ok(Some(args)) => args,
        Ok(None) => return,
        Err(err) => {
            eprintln!("\x1b[1;31mError:\x1b[0m {}\n", err);
            std::process::exit(1);
        }
    };

    terminal::clear_screen();

    let cancel = Arc::new(AtomicBool::new(false));
    let progress = Arc::new(du_sk_core::ScanProgress::default());

    let target_clone = cli_args.target_path.clone();
    let cancel_clone = cancel.clone();
    let progress_clone = progress.clone();

    let start = Instant::now();
    let scan_handle = thread::spawn(move || {
        du_sk_core::scan_directory(&target_clone, cancel_clone, progress_clone)
    });

    let mut frame = 0;
    let mut started = false;
    let mut cancelled = false;

    let raw_guard = terminal::RawModeGuard::enter();

    while !scan_handle.is_finished() {
        if terminal::check_quit_key() {
            cancel.store(true, Ordering::Relaxed);
            cancelled = true;
            break;
        }

        render::print_scan_progress(&progress, start.elapsed().as_secs_f64(), frame, started);
        started = true;
        frame += 1;

        thread::sleep(Duration::from_millis(50));
    }

    drop(raw_guard);
    render::clear_progress_lines(started);

    match scan_handle.join().unwrap() {
        Ok(result) => {
            let duration = start.elapsed();
            let fallback_bytes = progress.bytes_scanned.load(Ordering::Relaxed);
            let fallback_files = progress.files_scanned.load(Ordering::Relaxed);

            render::print_summary_header(
                &result,
                &cli_args.target_path,
                duration,
                cancelled,
                fallback_bytes,
                fallback_files,
            );

            if result.root_node.children.is_empty() {
                println!("  \x1b[38;5;244mNo items collected before cancellation.\x1b[0m\n");
                return;
            }

            if let Some(ref query) = cli_args.search_query {
                let search_start = Instant::now();
                let base_segments = vec![result.root_node.name.to_string()];
                let search_results =
                    result
                        .root_node
                        .search_subtree(&base_segments, query, cli_args.top_limit);
                let search_duration = search_start.elapsed();

                render::print_search_results(query, &search_results, search_duration);
            } else {
                render::print_tree_distribution(&result, cli_args.top_limit, fallback_bytes);
            }
        }
        Err(e) => {
            eprintln!("\n\x1b[1;31mScan failed:\x1b[0m {}\n", e);
            std::process::exit(1);
        }
    }
}
