use std::path::PathBuf;

use serde::Deserialize;

use crate::stream_config::StreamConfiguration;

#[derive(Deserialize)]
struct StoredConfig {
    #[serde(default)]
    streams: Vec<StreamConfiguration>,
}

pub struct ConfigurationStore {
    path: PathBuf,
}

impl ConfigurationStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn load(&self) -> Vec<StreamConfiguration> {
        let Ok(data) = std::fs::read_to_string(&self.path) else {
            return Vec::new();
        };

        match serde_json::from_str::<StoredConfig>(&data) {
            Ok(config) => config
                .streams
                .into_iter()
                .map(|s| StreamConfiguration::new(s.name, s.url))
                .collect(),
            Err(error) => {
                eprintln!("Error loading configuration: {error}");
                Vec::new()
            }
        }
    }

    pub fn save(&self, streams: &[StreamConfiguration]) -> bool {
        if let Some(directory) = self.path.parent() {
            if let Err(error) = std::fs::create_dir_all(directory) {
                eprintln!("Error creating configuration directory: {error}");
                return false;
            }
        }

        let payload = serde_json::json!({ "streams": streams });
        let serialized = serde_json::to_string_pretty(&payload).unwrap_or_default();

        match std::fs::write(&self.path, serialized) {
            Ok(_) => true,
            Err(error) => {
                eprintln!("Error saving configuration: {error}");
                false
            }
        }
    }
}
