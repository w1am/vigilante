mod commands;
mod config_store;
mod discovery;
mod menu;
mod relay_server;
mod stream_config;

use std::sync::{Arc, Mutex};

use tauri::Manager;

use config_store::ConfigurationStore;
use relay_server::Relay;
use stream_config::StreamConfiguration;

pub struct AppState {
    pub store: ConfigurationStore,
    pub streams: Mutex<Vec<StreamConfiguration>>,
    pub relay: Arc<Relay>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("GTK_A11Y", "none");
        std::env::set_var("NO_AT_BRIDGE", "1");
        std::env::set_var(
            "GST_PLUGIN_FEATURE_RANK",
            "vah264dec:MAX,nvh264dec:MAX,vaapih264dec:MAX",
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let config_path = app.path().app_data_dir()?.join("streams.json");
            let store = ConfigurationStore::new(config_path);
            let streams = store.load();

            let relay = Relay::new();
            relay.register_all(&streams);

            let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
            listener.set_nonblocking(true)?;
            let port = listener.local_addr()?.port();
            relay.set_port(port);
            println!("Stream relay server listening on port {port}");

            let router = relay_server::router(relay.clone());
            tauri::async_runtime::spawn(async move {
                match tokio::net::TcpListener::from_std(listener) {
                    Ok(listener) => {
                        if let Err(error) = axum::serve(listener, router).await {
                            eprintln!("Relay server error: {error}");
                        }
                    }
                    Err(error) => eprintln!("Failed to start relay server: {error}"),
                }
            });

            app.manage(AppState {
                store,
                streams: Mutex::new(streams),
                relay,
            });

            menu::setup_menu(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_configuration,
            commands::get_server_port,
            commands::add_stream,
            commands::remove_stream,
            commands::save_all_streams,
            commands::export_configuration,
            commands::import_configuration,
            commands::discover_streams,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
