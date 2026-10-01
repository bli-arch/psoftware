use mdns_sd::{ResolvedService, ServiceDaemon, ServiceEvent};
use serde::Serialize;
use std::collections::HashMap;
use std::time::{Duration, Instant};

const SERVICE_TYPE: &str = "_psoft._tcp.local.";
const SEARCH_DURATION: Duration = Duration::from_secs(4);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredServer {
    id: String,
    name: String,
    api_base: String,
    api_version: String,
}

pub async fn discover() -> Result<Vec<DiscoveredServer>, String> {
    tauri::async_runtime::spawn_blocking(discover_blocking)
        .await
        .map_err(|error| format!("La recherche de serveurs a échoué : {error}"))?
}

fn discover_blocking() -> Result<Vec<DiscoveredServer>, String> {
    let daemon = ServiceDaemon::new()
        .map_err(|error| format!("Impossible d'ouvrir la découverte locale : {error}"))?;
    let receiver = daemon
        .browse(SERVICE_TYPE)
        .map_err(|error| format!("Impossible de rechercher PServer : {error}"))?;
    let deadline = Instant::now() + SEARCH_DURATION;
    let mut servers = HashMap::new();

    while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
        let Ok(event) = receiver.recv_timeout(remaining) else {
            break;
        };
        if let ServiceEvent::ServiceResolved(service) = event {
            if let Some(server) = validated_server(&service) {
                servers.insert(server.id.clone(), server);
            }
        }
    }

    let _ = daemon.stop_browse(SERVICE_TYPE);
    let _ = daemon.shutdown();
    let mut servers: Vec<_> = servers.into_values().collect();
    servers.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(servers)
}

fn validated_server(service: &ResolvedService) -> Option<DiscoveredServer> {
    let id = service.get_property_val_str("id")?.trim();
    let name = service.get_property_val_str("name")?.trim();
    let api_version = service.get_property_val_str("apiVersion")?.trim();
    let hostname = service.get_hostname().trim_end_matches('.');
    let port = service.get_port();

    if service.get_property_val_str("tls") != Some("1")
        || !valid_uuid(id)
        || name.is_empty()
        || name.len() > 100
        || name.chars().any(char::is_control)
        || api_version.is_empty()
        || api_version.len() > 16
        || !api_version
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || value == '.' || value == '-')
        || !valid_local_hostname(hostname)
        || port == 0
    {
        return None;
    }

    let port = if port == 443 {
        String::new()
    } else {
        format!(":{port}")
    };
    Some(DiscoveredServer {
        id: id.to_string(),
        name: name.to_string(),
        api_base: format!("https://{hostname}{port}/api/v1"),
        api_version: api_version.to_string(),
    })
}

fn valid_local_hostname(hostname: &str) -> bool {
    hostname.ends_with(".local")
        && hostname.len() <= 253
        && hostname.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .chars()
                    .all(|value| value.is_ascii_alphanumeric() || value == '-')
        })
}

fn valid_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| {
            if matches!(index, 8 | 13 | 18 | 23) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
}
