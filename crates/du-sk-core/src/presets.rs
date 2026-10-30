use std::env;
use std::path::PathBuf;

pub struct PresetLocation {
    pub key: &'static str,
    pub label: &'static str,
    pub path: PathBuf,
}

pub fn get_preset_locations() -> Vec<PresetLocation> {
    let home = env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    vec![
        PresetLocation {
            key: "home",
            label: "Home Directory (~)",
            path: home.clone(),
        },
        PresetLocation {
            key: "library",
            label: "Library (~/Library)",
            path: home.join("Library"),
        },
        PresetLocation {
            key: "downloads",
            label: "Downloads (~/Downloads)",
            path: home.join("Downloads"),
        },
        PresetLocation {
            key: "documents",
            label: "Documents (~/Documents)",
            path: home.join("Documents"),
        },
        PresetLocation {
            key: "desktop",
            label: "Desktop (~/Desktop)",
            path: home.join("Desktop"),
        },
    ]
}
