use clap::Parser;
use std::fs;
use std::path::PathBuf;

const EXAMPLES: &str = "Examples:
  du-sk                                    Inspect current directory at depth 1 with top culprits
  du-sk ~/Library                          Inspect ~/Library
  du-sk . -d 2                             Inspect current directory down to depth 2
  du-sk . -a                               List all files and directories at depth 1 without culprits
  du-sk ~ -m 500M                          Filter items at least 500 MB
  du-sk /var/log -n 5                      Show top 5 items per directory in /var/log
  du-sk ~ --no-culprits                    Hide the top space-consuming folders table
  du-sk ~ --culprits-count 10              Show top 10 space-consuming folders
  du-sk ~ -s \"report.pdf\"                  Search for \"report.pdf\" in home directory";

#[derive(Parser, Debug)]
#[command(
    name = "du-sk",
    about = "Fast terminal disk space inspector",
    version,
    after_help = EXAMPLES
)]
pub struct CliArgs {
    #[arg(
        value_name = "TARGET",
        help = "Target directory path (defaults to current directory)"
    )]
    pub target: Option<String>,

    #[arg(
        short = 'a',
        long = "all",
        default_value_t = false,
        help = "Display all files and directories without truncation or top culprits"
    )]
    pub all: bool,

    #[arg(
        short = 'd',
        long = "depth",
        default_value_t = 1,
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
        default_value_t = 8,
        value_parser = validate_min_one,
        help = "Maximum number of items to display per branch"
    )]
    pub top: usize,

    #[arg(
        long = "no-culprits",
        default_value_t = false,
        help = "Do not show the largest space-consuming folders section"
    )]
    pub no_culprits: bool,

    #[arg(
        long = "culprits-count",
        default_value_t = 5,
        value_parser = validate_min_one,
        help = "Number of top space-consuming folders to display"
    )]
    pub culprits_count: usize,

    #[arg(
        short = 's',
        long = "search",
        help = "Search for files and directories matching a query string"
    )]
    pub search: Option<String>,
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
        let raw_path = if let Some(ref target_input) = self.target {
            PathBuf::from(target_input)
        } else {
            PathBuf::from(".")
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

    #[test]
    fn test_all_flag_parsing() {
        let args = CliArgs::try_parse_from(["du-sk", "-a"]).unwrap();
        assert!(args.all);
        assert_eq!(args.depth, 1);

        let args_explicit = CliArgs::try_parse_from(["du-sk", "-a", "-d", "3"]).unwrap();
        assert!(args_explicit.all);
        assert_eq!(args_explicit.depth, 3);
    }
}
