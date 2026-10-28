mod commands;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_default_target,
            commands::start_scan,
            commands::cancel_scan,
            commands::get_folder_children,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
