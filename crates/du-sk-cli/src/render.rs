use crate::format::{format_bytes, format_number, render_bar};
use du_sk_core::{ScanProgress, ScanResult, SearchResultItem};
use std::io::{self, Write};
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Duration;

pub fn print_scan_progress(progress: &ScanProgress, elapsed: f64, frame: usize, started: bool) {
    let spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let files = progress.files_scanned.load(Ordering::Relaxed);
    let bytes = progress.bytes_scanned.load(Ordering::Relaxed);
    let errors = progress.errors_count.load(Ordering::Relaxed);
    let current_path = progress.get_current_path();
    let spin_char = spinner[frame % spinner.len()];

    if started {
        print!("\x1b[1A\r");
    }

    print!(
        "\x1b[2K \x1b[1;38;5;208m{}\x1b[0m  Scanning...  \x1b[1;37m{}\x1b[0m files  \x1b[38;5;240m|\x1b[0m  \x1b[1;38;5;208m{}\x1b[0m  \x1b[38;5;240m|\x1b[0m  \x1b[38;5;244m{:.1}s\x1b[0m  \x1b[38;5;240m(\x1b[38;5;244mq to quit\x1b[38;5;240m)\x1b[0m",
        spin_char,
        format_number(files),
        format_bytes(bytes),
        elapsed
    );

    if errors > 0 {
        print!("  \x1b[38;5;203m({} errors)\x1b[0m", errors);
    }

    print!(
        "\n\x1b[2K  \x1b[38;5;240m↳\x1b[0m \x1b[38;5;244m{}\x1b[0m",
        current_path
    );

    let _ = io::stdout().flush();
}

pub fn clear_progress_lines(started: bool) {
    if started {
        print!("\r\x1b[2K\x1b[1A\r\x1b[2K\x1b[?25h");
    } else {
        print!("\r\x1b[2K\x1b[?25h");
    }
    let _ = io::stdout().flush();
}

pub fn print_summary_header(
    result: &ScanResult,
    target_path: &Path,
    duration: Duration,
    cancelled: bool,
    fallback_bytes: u64,
    fallback_files: u64,
) {
    let total_size = if result.total_bytes > 0 {
        result.total_bytes
    } else {
        fallback_bytes
    };
    let total_files = if result.total_files > 0 {
        result.total_files
    } else {
        fallback_files
    };

    if cancelled {
        println!("\x1b[1;38;5;208m┌─ du-sk \x1b[38;5;203m(Cancelled — Partial Results)\x1b[1;38;5;208m ────────────────────────────────────────┐\x1b[0m");
    } else {
        println!("\x1b[1;38;5;208m┌─ du-sk ──────────────────────────────────────────────────────────────────────┐\x1b[0m");
    }

    println!(
        "\x1b[1;38;5;208m│\x1b[0m Target:    \x1b[1;37m{:<65}\x1b[0m \x1b[1;38;5;208m│\x1b[0m",
        target_path.display()
    );
    println!(
        "\x1b[1;38;5;208m│\x1b[0m Total:     \x1b[1;38;5;208m{:<12}\x1b[0m  Files: \x1b[1;37m{:<12}\x1b[0m  Time: \x1b[38;5;244m{:<9.2?} \x1b[0m Errors: \x1b[38;5;{}m{:<5}\x1b[0m \x1b[1;38;5;208m│\x1b[0m",
        format_bytes(total_size),
        format_number(total_files),
        duration,
        if result.unreadable_paths.is_empty() { 244 } else { 203 },
        result.unreadable_paths.len()
    );
    println!("\x1b[1;38;5;208m└──────────────────────────────────────────────────────────────────────────────┘\x1b[0m\n");
}

pub fn print_search_results(query: &str, results: &[SearchResultItem], duration: Duration) {
    println!(
        " \x1b[1;38;5;208mSearch:\x1b[0m \"\x1b[1;37m{}\x1b[0m\" \x1b[38;5;244m({} matches found in {:.2?})\x1b[0m",
        query,
        results.len(),
        duration
    );
    println!(" \x1b[38;5;238m{}\x1b[0m", "─".repeat(77));
    println!(
        " \x1b[38;5;240m{:<6} {:>10}  {:<26}  RELATIVE PATH\x1b[0m",
        "KIND", "SIZE", "NAME"
    );
    println!(" \x1b[38;5;238m{}\x1b[0m", "─".repeat(77));

    if results.is_empty() {
        println!(
            "  \x1b[38;5;244mNo files or folders matching \"{}\".\x1b[0m\n",
            query
        );
        return;
    }

    let max_name_width = 26;
    for item in results {
        let (tag, tag_style) = if item.is_dir {
            ("DIR ", "\x1b[38;5;208m")
        } else {
            ("FILE", "\x1b[38;5;244m")
        };

        let name_display = if item.name.len() > max_name_width {
            format!("{}…", &item.name[..max_name_width - 1])
        } else {
            item.name.clone()
        };

        println!(
            " {tag_style}[{tag}]\x1b[0m \x1b[1;37m{:>10}\x1b[0m  \x1b[1;37m{:<26}\x1b[0m  \x1b[38;5;244m{}\x1b[0m",
            format_bytes(item.size),
            name_display,
            item.relative_path
        );
    }
    println!(" \x1b[38;5;238m{}\x1b[0m\n", "─".repeat(77));
}

pub fn print_tree_distribution(result: &ScanResult, top_limit: usize, fallback_bytes: u64) {
    let total_size = if result.total_bytes > 0 {
        result.total_bytes
    } else {
        fallback_bytes
    };

    let max_name_width = 30;
    println!(
        " \x1b[38;5;240m{:<6} {:>10}  {:>10}    {:<16}  NAME\x1b[0m",
        "KIND", "SIZE", "FILES", "DISTRIBUTION"
    );
    println!(" \x1b[38;5;238m{}\x1b[0m", "─".repeat(77));

    let visible_items: Vec<_> = result.root_node.children.iter().take(top_limit).collect();
    let mut displayed_bytes = 0u64;

    for item in &visible_items {
        displayed_bytes += item.size;
        let ratio = if total_size > 0 {
            item.size as f64 / total_size as f64
        } else {
            0.0
        };

        let (tag, tag_style) = if item.is_dir {
            ("DIR ", "\x1b[38;5;208m")
        } else {
            ("FILE", "\x1b[38;5;244m")
        };

        let name_truncated = if item.name.len() > max_name_width {
            format!("{}…", &item.name[..max_name_width - 1])
        } else {
            item.name.to_string()
        };

        let bar = render_bar(ratio, 16);

        println!(
            " {tag_style}[{tag}]\x1b[0m \x1b[1;37m{:>10}\x1b[0m  \x1b[1;37m{:>10}\x1b[0m  \x1b[38;5;208m{}\x1b[0m  \x1b[1;37m{}\x1b[0m",
            format_bytes(item.size),
            format_number(item.file_count),
            bar,
            name_truncated
        );
    }

    let remainder_count = result.root_node.children.len().saturating_sub(top_limit);
    let remainder_bytes = total_size.saturating_sub(displayed_bytes);
    let remainder_files = result
        .root_node
        .children
        .iter()
        .skip(top_limit)
        .map(|c| c.file_count)
        .sum::<u64>();

    if remainder_count > 0 && remainder_bytes > 0 {
        let rem_ratio = remainder_bytes as f64 / total_size as f64;
        let rem_bar = render_bar(rem_ratio, 16);
        println!(
            " \x1b[38;5;242m[REST] {:>10}  {:>10}    \x1b[38;5;242m{}\x1b[0m  {} other items\x1b[0m",
            format_bytes(remainder_bytes),
            format_number(remainder_files),
            rem_bar,
            format_number(remainder_count as u64)
        );
    }

    println!(" \x1b[38;5;238m{}\x1b[0m\n", "─".repeat(77));
}
