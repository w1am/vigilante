use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::Response,
    routing::get,
    Router,
};
use tokio::io::AsyncReadExt;
use tokio::process::Command;

use crate::stream_config::StreamConfiguration;

const CHUNK_SIZE: usize = 32 * 1024;

pub struct Relay {
    registry: Mutex<HashMap<usize, StreamConfiguration>>,
    port: Mutex<u16>,
}

impl Relay {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            registry: Mutex::new(HashMap::new()),
            port: Mutex::new(0),
        })
    }

    pub fn set_port(&self, port: u16) {
        *self.port.lock().unwrap() = port;
    }

    pub fn port(&self) -> u16 {
        *self.port.lock().unwrap()
    }

    pub fn register_all(&self, streams: &[StreamConfiguration]) {
        let mut registry = self.registry.lock().unwrap();
        registry.clear();
        for (index, stream) in streams.iter().enumerate() {
            if !stream.url.is_empty() {
                registry.insert(index, stream.clone());
            }
        }
    }

    fn lookup(&self, index: usize) -> Option<StreamConfiguration> {
        self.registry.lock().unwrap().get(&index).cloned()
    }
}

pub fn router(relay: Arc<Relay>) -> Router {
    Router::new()
        .route("/api/stream/:index", get(ws_handler))
        .with_state(relay)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(index): Path<usize>,
    State(relay): State<Arc<Relay>>,
) -> Response {
    ws.on_upgrade(move |socket| relay_stream(socket, index, relay))
}

async fn relay_stream(mut socket: WebSocket, index: usize, relay: Arc<Relay>) {
    let Some(stream) = relay.lookup(index) else {
        eprintln!("No stream configured for index {index}");
        let _ = socket.close().await;
        return;
    };

    if stream.url.is_empty() {
        let _ = socket.close().await;
        return;
    }

    println!("Client connected to stream {index}: {}", stream.url);

    let mut child = match Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-rtsp_transport",
            "tcp",
            "-i",
            stream.url.as_str(),
            "-f",
            "mpegts",
            "-codec:v",
            "mpeg1video",
            "-r",
            "30",
            "-b:v",
            "1000k",
            "-bf",
            "0",
            "-an",
            "pipe:1",
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            eprintln!("Failed to start FFmpeg (is it installed and on PATH?): {error}");
            let _ = socket.close().await;
            return;
        }
    };

    let mut stdout = child.stdout.take().expect("stdout was piped");
    let mut buffer = vec![0u8; CHUNK_SIZE];

    loop {
        tokio::select! {
            read = stdout.read(&mut buffer) => {
                match read {
                    Ok(0) => break,
                    Ok(n) => {
                        if socket.send(Message::Binary(buffer[..n].to_vec())).await.is_err() {
                            break;
                        }
                    }
                    Err(error) => {
                        eprintln!("Error reading FFmpeg output for stream {index}: {error}");
                        break;
                    }
                }
            }
            incoming = socket.recv() => {
                if incoming.is_none() {
                    break;
                }
            }
        }
    }

    let _ = child.kill().await;
    println!("Client disconnected from stream {index}");
}
