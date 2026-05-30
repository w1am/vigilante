use std::net::{IpAddr, UdpSocket};
use std::time::Duration;

use serde::Serialize;
use tokio::net::TcpStream;
use tokio::task::JoinSet;
use tokio::time::timeout;

const RTSP_PORT: u16 = 554;
const PROBE_TIMEOUT: Duration = Duration::from_millis(300);

#[derive(Serialize, Clone)]
pub struct Device {
    pub ip: String,
}

fn local_subnet() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;

    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(addr) => {
            let [a, b, c, _] = addr.octets();
            Some(format!("{a}.{b}.{c}"))
        }
        IpAddr::V6(_) => None,
    }
}

pub async fn discover() -> Vec<Device> {
    let Some(subnet) = local_subnet() else {
        return Vec::new();
    };

    let mut probes = JoinSet::new();
    for host in 1..=254 {
        let ip = format!("{subnet}.{host}");
        probes.spawn(async move {
            let addr = format!("{ip}:{RTSP_PORT}");
            match timeout(PROBE_TIMEOUT, TcpStream::connect(&addr)).await {
                Ok(Ok(_)) => Some(Device { ip }),
                _ => None,
            }
        });
    }

    let mut devices = Vec::new();
    while let Some(result) = probes.join_next().await {
        if let Ok(Some(device)) = result {
            devices.push(device);
        }
    }

    devices.sort_by(|a, b| {
        let key = |ip: &str| {
            ip.rsplit('.')
                .next()
                .and_then(|last| last.parse::<u8>().ok())
                .unwrap_or(0)
        };
        key(&a.ip).cmp(&key(&b.ip))
    });

    devices
}
