pub fn format_bytes(bytes: u64) -> String {
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

pub fn format_number(val: u64) -> String {
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

pub fn render_bar(ratio: f64, width: usize) -> String {
    let filled = ((ratio * width as f64).round() as usize).min(width);
    let empty = width.saturating_sub(filled);
    format!("{}{}", "■".repeat(filled), "·".repeat(empty))
}

pub fn render_tri_bar(scanned_ratio: f64, used_ratio: f64, width: usize) -> String {
    let scanned_w = ((scanned_ratio * width as f64).round() as usize).min(width);
    let total_used_w = ((used_ratio * width as f64).round() as usize).min(width);
    let other_used_w = total_used_w.saturating_sub(scanned_w);
    let free_w = width.saturating_sub(scanned_w + other_used_w);

    format!(
        "\x1b[38;5;208m{}\x1b[38;5;244m{}\x1b[38;5;238m{}\x1b[0m",
        "■".repeat(scanned_w),
        "■".repeat(other_used_w),
        "·".repeat(free_w)
    )
}
