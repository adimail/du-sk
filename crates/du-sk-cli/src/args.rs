use clap::Parser;
use du_sk_core::{get_preset_locations, PresetLocation};
use std::fs;
use std::path::PathBuf;

const EXAMPLES: &str = "Examples:
  du-sk                                    Inspect home directory down to depth 2
  du-sk ~/Library                          Inspect ~/Library
  du-sk downloads -d 3                     Inspect downloads preset down to depth 3
  du-sk ~ -d 3 -m 500M                     Filter items at least 500 MB up to depth 3
  du-sk /var/log -n 5                      Show top 5 items per directory in /var/log
  du-sk ~ -s \"report.pdf\"                  Search for \"report.pdf\" in home directory
  du-sk -p                                 List available preset shortcuts";

#[derive(Parser, Debug)]
#[command(
    name = "du-sk",
    about = "Fast terminal disk space inspector",
    version,
    after_help = EXAMPLES
)]
pub struct CliArgs {
    #[arg(
        value_name = "TARGET | PRESET",
        help = "Target directory path or preset key (e.g. home, downloads, library)"
    )]
    pub target: Option<String>,

    #[arg(
        short = 'd',
        long = "depth",
        default_value_t = 2,
        value_parser = validate_min_one,
        help = "Maximum directory tree depth to display"
    )]
    pub depth: usize,

    #[arg(
        short = 'm',
        long = "min-size",
        value_parser = parse_human_size,
        help = "Minimum item size threshold to display (e.g. 500M, 1.5GB)"
    )]
    pub min_size: Option<u64>,

    #[arg(
        short = 'n',
        long = "top",
        default_value_t = 10,
        value_parser = validate_min_one,
        help = "Maximum number of items to display per branch"
    )]
    pub top: usize,

    #[arg(
        short = 's',
        long = "search",
        help = "Search for files and directories matching a query string"
    )]
    pub search: Option<String>,

    #[arg(
        short = 'p',
        long = "presets",
        help = "List available preset target shortcuts and exit"
    )]
    pub presets: bool,
}

fn validate_min_one(s: &str) -> Result<usize, String> {
    let val: usize = s
        .parse()
        .map_err(|_| format!("'{}' is not a valid number", s))?;
    if val == 0 {
        return Err("Value must be at least 1".to_string());
    }
    Ok(val)
}

pub fn parse_human_size(s: &str) -> Result<u64, String> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err("Size cannot be empty".to_string());
    }
    if trimmed.starts_with('-') {
        return Err("Size cannot be negative".to_string());
    }

    let split_pos = trimmed
        .find(|c: char| !c.is_ascii_digit() && c != '.')
        .unwrap_or(trimmed.len());

    let (num_part, unit_part) = trimmed.split_at(split_pos);
    if num_part.is_empty() {
        return Err(format!("Invalid size: '{}'", s));
    }

    let number: f64 = num_part
        .parse()
        .map_err(|_| format!("Invalid numeric value in size: '{}'", num_part))?;

    if number < 0.0 || number.is_nan() || number.is_infinite() {
        return Err(format!(
            "Size must be a valid positive number: '{}'",
            num_part
        ));
    }

    let unit = unit_part.trim().to_ascii_lowercase();
    let multiplier: f64 = match unit.as_str() {
        "" | "b" | "bytes" => 1.0,
        "k" | "kb" | "kib" => 1024.0,
        "m" | "mb" | "mib" => 1024.0 * 1024.0,
        "g" | "gb" | "gib" => 1024.0 * 1024.0 * 1024.0,
        "t" | "tb" | "tib" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => return Err(format!("Unknown size unit: '{}'", unit_part)),
    };

    let total = number * multiplier;
    if total > u64::MAX as f64 {
        return Err("Size exceeds maximum allowed limit".to_string());
    }

    Ok(total.round() as u64)
}

impl CliArgs {
    pub fn resolve_target_path(&self) -> Result<PathBuf, String> {
        let presets = get_preset_locations();
        let raw_path = if let Some(ref target_input) = self.target {
            if let Some(matched) = presets
                .iter()
                .find(|p| p.key.eq_ignore_ascii_case(target_input))
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

        let target_path = match fs::canonicalize(&raw_path) {
            Ok(canonical) => canonical,
            Err(_) => {
                return Err(format!(
                    "Target path does not exist: {}",
                    raw_path.display()
                ));
            }
        };

        if !target_path.is_dir() {
            return Err(format!(
                "Target path is not a directory: {}",
                target_path.display()
            ));
        }

        Ok(target_path)
    }
}

pub fn print_presets(presets: &[PresetLocation]) {
    println!("\x1b[1;37mAvailable Presets:\x1b[0m\n");
    for p in presets {
        println!(
            "  \x1b[1;38;5;208m{:<10}\x1b[0m {:<22} \x1b[38;5;244m{}\x1b[0m",
            p.key,
            p.label,
            p.path.display()
        );
    }
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_human_size_units() {
        assert_eq!(parse_human_size("1024").unwrap(), 1024);
        assert_eq!(parse_human_size("1k").unwrap(), 1024);
        assert_eq!(parse_human_size("1K").unwrap(), 1024);
        assert_eq!(parse_human_size("1KB").unwrap(), 1024);
        assert_eq!(parse_human_size("1kb").unwrap(), 1024);
        assert_eq!(parse_human_size("500M").unwrap(), 524_288_000);
        assert_eq!(parse_human_size("500mb").unwrap(), 524_288_000);
        assert_eq!(parse_human_size("1.5G").unwrap(), 1_610_612_736);
        assert_eq!(parse_human_size("1.5gb").unwrap(), 1_610_612_736);
    }

    #[test]
    fn test_parse_human_size_invalid() {
        assert!(parse_human_size("").is_err());
        assert!(parse_human_size("-50M").is_err());
        assert!(parse_human_size("abc").is_err());
        assert!(parse_human_size("12X").is_err());
    }
}
