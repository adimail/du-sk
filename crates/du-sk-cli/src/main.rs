use std::env;
use std::fs;
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

struct RawModeGuard {
    orig: libc::termios,
}

impl RawModeGuard {
    fn enter() -> Option<Self> {
        unsafe {
            let mut orig = std::mem::zeroed();
            if libc::tcgetattr(libc::STDIN_FILENO, &mut orig) != 0 {
                return None;
            }
            let mut raw = orig;
            raw.c_lflag &= !(libc::ICANON | libc::ECHO);
            raw.c_cc[libc::VMIN] = 0;
            raw.c_cc[libc::VTIME] = 0;
            if libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, &raw) != 0 {
                return None;
            }
            Some(Self { orig })
        }
    }
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        unsafe {
            libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, &self.orig);
        }
    }
}

struct Preset {
    key: &'static str,
    label: &'static str,
    path: PathBuf,
}

fn get_presets() -> Vec<Preset> {
    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    vec![
        Preset {
            key: "home",
            label: "Home Directory (~)",
            path: home.clone(),
        },
        Preset {
            key: "library",
            label: "Library (~/Library)",
            path: home.join("Library"),
        },
        Preset {
            key: "downloads",
            label: "Downloads (~/Downloads)",
            path: home.join("Downloads"),
        },
        Preset {
            key: "documents",
            label: "Documents (~/Documents)",
            path: home.join("Documents"),
        },
        Preset {
            key: "desktop",
            label: "Desktop (~/Desktop)",
            path: home.join("Desktop"),
        },
    ]
}

fn format_bytes(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    const TB: f64 = GB * 1024.0;

    let b = bytes as f64;
    if b >= TB {
        format!("{:.2} TB", b / TB)
    } else if b >= GB {
        format!("{:.2} GB", b / GB)
    } else if b >= MB {
        format!("{:.1} MB", b / MB)
    } else if b >= KB {
        format!("{:.1} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

fn format_number(val: u64) -> String {
    let s = val.to_string();
    let mut out = String::new();
    let len = s.len();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (len - i).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    out
}

fn render_bar(ratio: f64, width: usize) -> String {
    let filled = ((ratio * width as f64).round() as usize).min(width);
    let empty = width.saturating_sub(filled);
    format!("{}{}", "■".repeat(filled), "·".repeat(empty))
}

fn print_help(presets: &[Preset]) {
    println!("\x1b[1;38;5;208mdu-sk-cli\x1b[0m - Fast terminal disk space inspector\n");
    println!("\x1b[1;37mUSAGE:\x1b[0m");
    println!("  du-sk-cli [TARGET | PRESET] [-s <QUERY>] [-n <N>]\n");
    println!("\x1b[1;37mPRESETS:\x1b[0m");
    for p in presets {
        println!(
            "  \x1b[38;5;208m{:<12}\x1b[0m \x1b[38;5;244m{}\x1b[0m",
            p.key,
            p.path.display()
        );
    }
    println!("\n\x1b[1;37mOPTIONS:\x1b[0m");
    println!(
        "  \x1b[38;5;208m-s, --search <QUERY>\x1b[0m  Search across all scanned files and folders"
    );
    println!("  \x1b[38;5;208m-n, --top <N>\x1b[0m        Number of items to show (default: 15)");
    println!("  \x1b[38;5;208m-p, --presets\x1b[0m        List available preset targets");
    println!("  \x1b[38;5;208m-h, --help\x1b[0m            Show help information\n");
}

fn main() {
    let presets = get_presets();
    let args: Vec<String> = env::args().skip(1).collect();

    let mut target_str: Option<String> = None;
    let mut search_query: Option<String> = None;
    let mut top_limit: usize = 15;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "-h" | "--help" => {
                print_help(&presets);
                return;
            }
            "-p" | "--presets" => {
                println!("\x1b[1;37mAvailable Presets:\x1b[0m\n");
                for p in &presets {
                    println!(
                        "  \x1b[1;38;5;208m{:<10}\x1b[0m {:<22} \x1b[38;5;244m{}\x1b[0m",
                        p.key,
                        p.label,
                        p.path.display()
                    );
                }
                println!();
                return;
            }
            "-s" | "--search" => {
                if i + 1 < args.len() {
                    search_query = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "-n" | "--top" => {
                if i + 1 < args.len() {
                    if let Ok(val) = args[i + 1].parse::<usize>() {
                        top_limit = val;
                    }
                    i += 1;
                }
            }
            other => {
                if !other.starts_with('-') && target_str.is_none() {
                    target_str = Some(other.to_string());
                }
            }
        }
        i += 1;
    }

    let raw_target_path = if let Some(target_input) = target_str {
        if let Some(matched) = presets
            .iter()
            .find(|p| p.key.eq_ignore_ascii_case(&target_input))
        {
            matched.path.clone()
        } else {
            PathBuf::from(target_input)
        }
    } else {
        presets
            .iter()
            .find(|p| p.key == "home")
            .map(|p| p.path.clone())
            .unwrap_or_else(|| PathBuf::from("."))
    };

    let target_path = match fs::canonicalize(&raw_target_path) {
        Ok(canonical) => canonical,
        Err(_) => {
            eprintln!(
                "\x1b[1;31mError:\x1b[0m Target path does not exist: {}",
                raw_target_path.display()
            );
            std::process::exit(1);
        }
    };

    if !target_path.is_dir() {
        eprintln!(
            "\x1b[1;31mError:\x1b[0m Target path is not a directory: {}",
            target_path.display()
        );
        std::process::exit(1);
    }

    println!("\x1b[2J\x1b[H\x1b[?25l");

    let cancel = Arc::new(AtomicBool::new(false));
    let progress = Arc::new(du_sk_core::ScanProgress::default());

    let target_clone = target_path.clone();
    let cancel_clone = cancel.clone();
    let progress_clone = progress.clone();

    let start = Instant::now();
    let scan_handle = thread::spawn(move || {
        du_sk_core::scan_directory(&target_clone, cancel_clone, progress_clone)
    });

    let spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let mut frame = 0;
    let mut started = false;
    let mut cancelled = false;

    let raw_guard = RawModeGuard::enter();
    print!("\x1b[?7l");

    let mut stdin_stream = io::stdin();
    let mut key_buf = [0u8; 1];

    while !scan_handle.is_finished() {
        if let Ok(n) = stdin_stream.read(&mut key_buf) {
            if n > 0 && (key_buf[0] == b'q' || key_buf[0] == b'Q' || key_buf[0] == 3) {
                cancel.store(true, Ordering::Relaxed);
                cancelled = true;
                break;
            }
        }

        let files = progress.files_scanned.load(Ordering::Relaxed);
        let bytes = progress.bytes_scanned.load(Ordering::Relaxed);
        let errors = progress.errors_count.load(Ordering::Relaxed);
        let current_path = progress.get_current_path();
        let elapsed = start.elapsed().as_secs_f64();
        let spin_char = spinner[frame % spinner.len()];
        frame += 1;

        if started {
            print!("\x1b[1A\r");
        }
        started = true;

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
        thread::sleep(Duration::from_millis(50));
    }

    drop(raw_guard);
    print!("\x1b[?7h");

    if started {
        print!("\r\x1b[2K\x1b[1A\r\x1b[2K\x1b[?25h");
    } else {
        print!("\r\x1b[2K\x1b[?25h");
    }
    let _ = io::stdout().flush();

    match scan_handle.join().unwrap() {
        Ok(result) => {
            let duration = start.elapsed();
            let total_size = if result.total_bytes > 0 {
                result.total_bytes
            } else {
                progress.bytes_scanned.load(Ordering::Relaxed)
            };
            let total_files = if result.total_files > 0 {
                result.total_files
            } else {
                progress.files_scanned.load(Ordering::Relaxed)
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

            if result.root_node.children.is_empty() {
                println!("  \x1b[38;5;244mNo items collected before cancellation.\x1b[0m\n");
                return;
            }

            if let Some(ref query) = search_query {
                let search_start = Instant::now();
                let base_segments = vec![result.root_node.name.to_string()];
                let search_results =
                    result
                        .root_node
                        .search_subtree(&base_segments, query, top_limit);
                let search_duration = search_start.elapsed();

                println!(
                    " \x1b[1;38;5;208mSearch:\x1b[0m \"\x1b[1;37m{}\x1b[0m\" \x1b[38;5;244m({} matches found in {:.2?})\x1b[0m",
                    query,
                    search_results.len(),
                    search_duration
                );
                println!(" \x1b[38;5;238m{}\x1b[0m", "─".repeat(77));
                println!(
                    " \x1b[38;5;240m{:<6} {:>10}  {:<26}  RELATIVE PATH\x1b[0m",
                    "KIND", "SIZE", "NAME"
                );
                println!(" \x1b[38;5;238m{}\x1b[0m", "─".repeat(77));

                if search_results.is_empty() {
                    println!(
                        "  \x1b[38;5;244mNo files or folders matching \"{}\".\x1b[0m\n",
                        query
                    );
                } else {
                    let max_name_width = 26;
                    for item in &search_results {
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

                return;
            }

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
        Err(e) => {
            eprintln!("\n\x1b[1;31mScan failed:\x1b[0m {}\n", e);
            std::process::exit(1);
        }
    }
}
