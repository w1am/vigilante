use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Default, Debug)]
pub struct StreamConfiguration {
    pub name: String,
    pub url: String,
}

impl StreamConfiguration {
    pub fn new(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            name: name.into().trim().to_string(),
            url: url.into().trim().to_string(),
        }
    }
}
