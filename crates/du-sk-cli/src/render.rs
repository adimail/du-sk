use crate::format::{format_bytes, format_number, render_bar, render_tri_bar};
use crate::terminal::get_terminal_width;
use du_sk_core::{ScanProgress, ScanResult, SearchResultItem};
use std::io::{self, Write};
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Duration;

fn truncate_str(s: &str, max_chars: usize) -> String {
    let char_count = s.chars().count();
    if char_count <= max_chars {
        s.to_string()
    } else if max_chars > 1 {
        let truncated: String = s.chars().take(max_chars - 1).collect();
        format!("{}…", truncated)
    } else {
        s.chars().take(max_chars).collect()
    }
}

fn pad_right(s: &str, width: usize) -> String {
    let len = s.chars().count();
    if len >= width {
        s.to_string()
    } else {
        format!("{}{}", s, " ".repeat(width - len))
    }
}

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
    let width = get_terminal_width();
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

    let inner_w = width.saturating_sub(4);
    let content_w = inner_w.saturating_sub(11);

    if cancelled {
        let tag = "┌─ du-sk (Cancelled — Partial Results) ";
        let dashes = width.saturating_sub(tag.len() + 1);
        println!(
            "\x1b[1;38;5;208m┌─ du-sk \x1b[38;5;203m(Cancelled — Partial Results)\x1b[1;38;5;208m {}┐\x1b[0m",
            "─".repeat(dashes)
        );
    } else {
        let tag = "┌─ du-sk ";
        let dashes = width.saturating_sub(tag.len() + 1);
        println!("\x1b[1;38;5;208m┌─ du-sk {}┐\x1b[0m", "─".repeat(dashes));
    }

    let target_str = target_path.display().to_string();
    let target_padded = pad_right(&truncate_str(&target_str, content_w), content_w);
    println!(
        "\x1b[1;38;5;208m│\x1b[0m Target:    \x1b[1;37m{}\x1b[0m \x1b[1;38;5;208m│\x1b[0m",
        target_padded
    );

    if let Some(ref disk) = result.disk_space {
        let total_disk = disk.total_bytes;
        let free_disk = disk.available_bytes;
        let used_disk = total_disk.saturating_sub(disk.free_bytes);

        let scanned_of_disk_pct = if total_disk > 0 {
            (total_size as f64 / total_disk as f64) * 100.0
        } else {
            0.0
        };

        let is_low_space = free_disk < 15 * 1024 * 1024 * 1024;
        let free_label = if is_low_space {
            format!("{} Free [LOW]", format_bytes(free_disk))
        } else {
            format!("{} Free", format_bytes(free_disk))
        };

        let drive_str = format!(
            "{} Total · {} Used · {}",
            format_bytes(total_disk),
            format_bytes(used_disk),
            free_label
        );
        let drive_padded = pad_right(&truncate_str(&drive_str, content_w), content_w);
        println!(
            "\x1b[1;38;5;208m│\x1b[0m Drive:     \x1b[1;37m{}\x1b[0m \x1b[1;38;5;208m│\x1b[0m",
            drive_padded
        );

        let scanned_str = format!(
            "{} ({:.1}% of Drive)",
            format_bytes(total_size),
            scanned_of_disk_pct
        );
        let scanned_padded = pad_right(&truncate_str(&scanned_str, content_w), content_w);
        println!(
            "\x1b[1;38;5;208m│\x1b[0m Scanned:   \x1b[1;38;5;208m{}\x1b[0m \x1b[1;38;5;208m│\x1b[0m",
            scanned_padded
        );

        let scanned_ratio = if total_disk > 0 {
            (total_size as f64 / total_disk as f64).clamp(0.0, 1.0)
        } else {
            0.0
        };
        let used_ratio = if total_disk > 0 {
            (used_disk as f64 / total_disk as f64).clamp(0.0, 1.0)
        } else {
            0.0
        };

        let bar_w = content_w.saturating_sub(2).clamp(16, 48);
        let bar = render_tri_bar(scanned_ratio, used_ratio, bar_w);
        let usage_rem = content_w.saturating_sub(bar_w + 2);

        println!(
            "\x1b[1;38;5;208m│\x1b[0m Usage:     [{}] \x1b[38;5;244m{}\x1b[0m \x1b[1;38;5;208m│\x1b[0m",
            bar,
            " ".repeat(usage_rem.saturating_sub(1))
        );

        let summary_str = format!(
            "Files: {} · Time: {:.2?} · Errors: {}",
            format_number(total_files),
            duration,
            result.unreadable_paths.len()
        );
        let summary_padded = pad_right(&truncate_str(&summary_str, content_w), content_w);
        println!(
            "\x1b[1;38;5;208m│\x1b[0m Summary:   \x1b[38;5;244m{}\x1b[0m \x1b[1;38;5;208m│\x1b[0m",
            summary_padded
        );
    } else {
        let line = format!(
            "Total: {} · Files: {} · Time: {:.2?} · Errors: {}",
            format_bytes(total_size),
            format_number(total_files),
            duration,
            result.unreadable_paths.len()
        );
        let line_padded = pad_right(&truncate_str(&line, content_w), content_w);
        println!(
            "\x1b[1;38;5;208m│\x1b[0m Summary:   \x1b[1;37m{}\x1b[0m \x1b[1;38;5;208m│\x1b[0m",
            line_padded
        );
    }

    println!(
        "\x1b[1;38;5;208m└{}┘\x1b[0m\n",
        "─".repeat(width.saturating_sub(2))
    );
}

pub fn print_search_results(query: &str, results: &[SearchResultItem], duration: Duration) {
    let width = get_terminal_width();
    let divider = "─".repeat(width.saturating_sub(2));

    println!(
        " \x1b[1;38;5;208mSearch:\x1b[0m \"\x1b[1;37m{}\x1b[0m\" \x1b[38;5;244m({} matches found in {:.2?})\x1b[0m",
        query,
        results.len(),
        duration
    );
    println!(" \x1b[38;5;238m{}\x1b[0m", divider);
    println!(
        " \x1b[38;5;240m{:<6} {:>10}  {:<26}  RELATIVE PATH\x1b[0m",
        "KIND", "SIZE", "NAME"
    );
    println!(" \x1b[38;5;238m{}\x1b[0m", divider);

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

        let name_display = truncate_str(&item.name, max_name_width);

        println!(
            " {tag_style}[{tag}]\x1b[0m \x1b[1;37m{:>10}\x1b[0m  \x1b[1;37m{:<26}\x1b[0m  \x1b[38;5;244m{}\x1b[0m",
            format_bytes(item.size),
            name_display,
            item.relative_path
        );
    }
    println!(" \x1b[38;5;238m{}\x1b[0m\n", divider);
}

pub fn print_tree_distribution(result: &ScanResult, top_limit: usize, fallback_bytes: u64) {
    let width = get_terminal_width();
    let divider = "─".repeat(width.saturating_sub(2));

    let total_size = if result.total_bytes > 0 {
        result.total_bytes
    } else {
        fallback_bytes
    };

    let bar_width = 16;
    let max_name_width = width.saturating_sub(50).max(20);

    println!(
        " \x1b[38;5;240m{:<6} {:>10}  {:>10}    {:<16}  NAME\x1b[0m",
        "KIND", "SIZE", "FILES", "DISTRIBUTION"
    );
    println!(" \x1b[38;5;238m{}\x1b[0m", divider);

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

        let name_truncated = truncate_str(&item.name, max_name_width);
        let bar = render_bar(ratio, bar_width);

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
        let rem_bar = render_bar(rem_ratio, bar_width);
        println!(
            " \x1b[38;5;242m[REST] {:>10}  {:>10}    \x1b[38;5;242m{}\x1b[0m  {} other items\x1b[0m",
            format_bytes(remainder_bytes),
            format_number(remainder_files),
            rem_bar,
            format_number(remainder_count as u64)
        );
    }

    println!(" \x1b[38;5;238m{}\x1b[0m\n", divider);
}
