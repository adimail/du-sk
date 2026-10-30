use std::env;
use std::fs;
use std::path::PathBuf;

pub struct Preset {
    pub key: &'static str,
    pub label: &'static str,
    pub path: PathBuf,
}

pub fn get_presets() -> Vec<Preset> {
    let home = env::var("HOME")
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

pub struct CliArgs {
    pub target_path: PathBuf,
    pub search_query: Option<String>,
    pub top_limit: usize,
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

fn print_presets(presets: &[Preset]) {
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

pub fn parse_args() -> Result<Option<CliArgs>, String> {
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
                return Ok(None);
            }
            "-p" | "--presets" => {
                print_presets(&presets);
                return Ok(None);
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
                        top_limit = val.max(1);
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
            return Err(format!(
                "Target path does not exist: {}",
                raw_target_path.display()
            ));
        }
    };

    if !target_path.is_dir() {
        return Err(format!(
            "Target path is not a directory: {}",
            target_path.display()
        ));
    }

    Ok(Some(CliArgs {
        target_path,
        search_query,
        top_limit,
    }))
}
