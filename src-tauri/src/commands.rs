use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::stream_config::StreamConfiguration;
use crate::{discovery, AppState};

#[derive(Serialize)]
pub struct Configuration {
    pub streams: Vec<StreamConfiguration>,
}

fn persist(state: &AppState, streams: &[StreamConfiguration]) {
    state.store.save(streams);
    state.relay.register_all(streams);
}

#[tauri::command]
pub fn get_configuration(state: State<AppState>) -> Configuration {
    Configuration {
        streams: state.streams.lock().unwrap().clone(),
    }
}

#[tauri::command]
pub fn get_server_port(state: State<AppState>) -> u16 {
    state.relay.port()
}

#[tauri::command]
pub fn add_stream(name: Option<String>, url: Option<String>, state: State<AppState>) -> usize {
    let mut streams = state.streams.lock().unwrap();
    let index = streams.len();
    streams.push(StreamConfiguration::new(
        name.unwrap_or_default(),
        url.unwrap_or_default(),
    ));
    persist(&state, &streams);
    index
}

#[tauri::command]
pub fn remove_stream(index: usize, state: State<AppState>) -> bool {
    let mut streams = state.streams.lock().unwrap();
    if index >= streams.len() {
        return false;
    }
    streams.remove(index);
    persist(&state, &streams);
    true
}

#[tauri::command]
pub fn save_all_streams(streams: Vec<StreamConfiguration>, state: State<AppState>) -> bool {
    let normalized: Vec<StreamConfiguration> = streams
        .into_iter()
        .map(|s| StreamConfiguration::new(s.name, s.url))
        .collect();

    let mut guard = state.streams.lock().unwrap();
    *guard = normalized;
    persist(&state, &guard);
    true
}

#[tauri::command]
pub async fn export_configuration(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let config = {
        let streams = state.streams.lock().unwrap();
        json!({ "streams": streams.clone() })
    };

    let default_name = format!("streams-{}.json", chrono::Local::now().format("%Y-%m-%d"));

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name(&default_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let Some(file_path) = rx.await.map_err(|e| e.to_string())? else {
        return Ok(json!({ "success": false }));
    };

    let path = match file_path.into_path() {
        Ok(path) => path,
        Err(error) => return Ok(json!({ "success": false, "error": error.to_string() })),
    };

    let serialized = serde_json::to_string_pretty(&config).unwrap_or_default();
    match std::fs::write(&path, serialized) {
        Ok(_) => Ok(json!({ "success": true })),
        Err(error) => Ok(json!({ "success": false, "error": error.to_string() })),
    }
}

#[tauri::command]
pub async fn import_configuration(app: AppHandle) -> Result<Value, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON", &["json"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let Some(file_path) = rx.await.map_err(|e| e.to_string())? else {
        return Ok(json!({ "success": false }));
    };

    let path = match file_path.into_path() {
        Ok(path) => path,
        Err(error) => return Ok(json!({ "success": false, "error": error.to_string() })),
    };

    let contents = match std::fs::read_to_string(&path) {
        Ok(contents) => contents,
        Err(error) => return Ok(json!({ "success": false, "error": error.to_string() })),
    };

    match serde_json::from_str::<Value>(&contents) {
        Ok(value) => {
            if value.get("streams").and_then(Value::as_array).is_some() {
                Ok(json!({ "success": true, "config": value }))
            } else {
                Ok(json!({ "success": false, "error": "Invalid configuration format" }))
            }
        }
        Err(error) => Ok(json!({ "success": false, "error": error.to_string() })),
    }
}

#[tauri::command]
pub async fn discover_streams() -> Result<Value, String> {
    let devices = discovery::discover().await;
    Ok(json!({ "success": true, "streams": devices }))
}
