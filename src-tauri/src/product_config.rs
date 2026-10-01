use base64::{engine::general_purpose, Engine as _};
use minisign_verify::{PublicKey, Signature};
use reqwest::Url;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const MAGIC: &[u8; 8] = b"\x89PSCF\r\n\x1a";
const SCHEMA_VERSION: u8 = 2;
const HEADER_LENGTH: usize = 14;
const FILE_NAME: &str = "manifest";
const UPDATE_PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEJEQTkxMThEMkUzMkIKUldRcjQ5SVlrZG9MQU1VMHRrNDdleUhmOEQxMktCek9XRmJqWkVWVHNuajlqS01URkVhcWI2QmoK";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Product {
    PSoftware = 1,
    PServer = 2,
}

impl Product {
    fn index(self) -> usize {
        self as usize - 1
    }
}

pub fn install_bundled(target_directory: &Path) -> Result<(), String> {
    let source = bundled_path()?;
    let bytes = read_verified(&source)?;
    decode(Product::PSoftware, &bytes)?;
    decode(Product::PServer, &bytes)?;
    fs::create_dir_all(target_directory)
        .map_err(|error| format!("Impossible de préparer le dossier de configuration: {error}"))?;

    let target = target_directory.join(FILE_NAME);
    let source_signature = signature_path(&source);
    let target_signature = signature_path(&target);
    make_writable(&target)?;
    make_writable(&target_signature)?;
    fs::copy(&source, &target)
        .map_err(|error| format!("Impossible d'installer la configuration signée: {error}"))?;

    if source_signature.is_file() {
        fs::copy(&source_signature, &target_signature).map_err(|error| {
            format!("Impossible d'installer la signature de configuration: {error}")
        })?;
    } else if !cfg!(debug_assertions) {
        return Err("La signature de configuration est absente.".into());
    }

    protect(&target)?;
    if target_signature.is_file() {
        protect(&target_signature)?;
    }
    remove_legacy_files(target_directory);
    Ok(())
}

pub fn remove_legacy_bundled_files() {
    if let Ok(path) = bundled_path() {
        if let Some(directory) = path.parent() {
            remove_legacy_files(directory);
        }
    }
}

fn remove_legacy_files(directory: &Path) {
    for name in [
        "PSoftware.pscfg",
        "PSoftware.pscfg.sig",
        "PServer.pscfg",
        "PServer.pscfg.sig",
    ] {
        let path = directory.join(name);
        let _ = make_writable(&path);
        let _ = fs::remove_file(path);
    }
}

pub fn verify_signature(bytes: &[u8], encoded_signature: &str) -> Result<(), String> {
    let public_key = decode_public_key()?;
    let signature = decode_signature(encoded_signature)?;
    public_key
        .verify(bytes, &signature, false)
        .map_err(|_| "La signature est invalide.".to_string())
}

fn read_verified(path: &Path) -> Result<Vec<u8>, String> {
    let bytes = fs::read(path).map_err(|error| {
        format!(
            "Impossible de lire la configuration signée {}: {error}",
            path.display()
        )
    })?;
    let signature_path = signature_path(path);

    if signature_path.is_file() {
        let signature = fs::read_to_string(&signature_path).map_err(|error| {
            format!(
                "Impossible de lire la signature de configuration {}: {error}",
                signature_path.display()
            )
        })?;
        verify_signature(&bytes, signature.trim())?;
    } else if !cfg!(debug_assertions) {
        return Err(format!(
            "La signature de configuration est absente: {}",
            signature_path.display()
        ));
    }

    Ok(bytes)
}

fn decode(product: Product, bytes: &[u8]) -> Result<Url, String> {
    if bytes.len() < HEADER_LENGTH || &bytes[..MAGIC.len()] != MAGIC {
        return Err("Le format de configuration est invalide.".into());
    }
    if bytes[8] != SCHEMA_VERSION {
        return Err(format!(
            "Version de configuration non prise en charge: {}.",
            bytes[8]
        ));
    }
    let lengths = [
        u16::from_le_bytes([bytes[10], bytes[11]]) as usize,
        u16::from_le_bytes([bytes[12], bytes[13]]) as usize,
    ];
    let payload_length = lengths.iter().sum::<usize>();
    if bytes.len() != HEADER_LENGTH + payload_length {
        return Err("La taille de la configuration est invalide.".into());
    }

    let decoded = bytes[HEADER_LENGTH..]
        .iter()
        .enumerate()
        .map(|(index, byte)| byte ^ obfuscation_byte(index))
        .collect::<Vec<_>>();
    let start = lengths.iter().take(product.index()).sum::<usize>();
    let end = start + lengths[product.index()];
    let value = String::from_utf8(decoded[start..end].to_vec())
        .map_err(|_| "L'URL de configuration n'est pas valide.".to_string())?;
    validate_update_url(&value)
}

fn validate_update_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|error| format!("URL de mise à jour invalide: {error}"))?;
    if matches!(url.scheme(), "http" | "https")
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
    {
        Ok(url)
    } else {
        Err("L’URL de mise à jour doit utiliser HTTP ou HTTPS sans identifiants.".into())
    }
}

fn obfuscation_byte(index: usize) -> u8 {
    0xa5u8.wrapping_add((index as u8).wrapping_mul(31))
}

fn bundled_path() -> Result<PathBuf, String> {
    let directory = env::current_exe()
        .map_err(|error| format!("Impossible de localiser PSoftware: {error}"))?
        .parent()
        .ok_or_else(|| "Impossible de localiser les ressources PSoftware.".to_string())?
        .to_path_buf();
    Ok(directory.join("resources").join(FILE_NAME))
}

fn signature_path(path: &Path) -> PathBuf {
    let mut value = path.as_os_str().to_os_string();
    value.push(".sig");
    PathBuf::from(value)
}

fn protect(path: &Path) -> Result<(), String> {
    let mut permissions = fs::metadata(path)
        .map_err(|error| {
            format!(
                "Impossible de lire les permissions {}: {error}",
                path.display()
            )
        })?
        .permissions();
    if !permissions.readonly() {
        permissions.set_readonly(true);
        fs::set_permissions(path, permissions).map_err(|error| {
            format!(
                "Impossible de protéger la configuration {}: {error}",
                path.display()
            )
        })?;
    }
    Ok(())
}

fn make_writable(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let mut permissions = fs::metadata(path)
        .map_err(|error| {
            format!(
                "Impossible de lire les permissions {}: {error}",
                path.display()
            )
        })?
        .permissions();
    if permissions.readonly() {
        permissions.set_readonly(false);
        fs::set_permissions(path, permissions).map_err(|error| {
            format!(
                "Impossible de remplacer la configuration {}: {error}",
                path.display()
            )
        })?;
    }
    Ok(())
}

fn decode_public_key() -> Result<PublicKey, String> {
    let raw = general_purpose::STANDARD
        .decode(UPDATE_PUBLIC_KEY)
        .map_err(|_| "La clé publique de mise à jour est invalide.".to_string())?;
    let text = String::from_utf8(raw)
        .map_err(|_| "La clé publique de mise à jour est invalide.".to_string())?;
    PublicKey::decode(&text).map_err(|_| "La clé publique de mise à jour est invalide.".to_string())
}

fn decode_signature(encoded_signature: &str) -> Result<Signature, String> {
    let raw = general_purpose::STANDARD
        .decode(encoded_signature.trim())
        .map_err(|_| "La signature est invalide.".to_string())?;
    let text = String::from_utf8(raw).map_err(|_| "La signature est invalide.".to_string())?;
    Signature::decode(&text).map_err(|_| "La signature est invalide.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encoded(psoftware: &str, pserver: &str) -> Vec<u8> {
        let raw = [psoftware, pserver].concat();
        let payload = raw
            .as_bytes()
            .iter()
            .enumerate()
            .map(|(index, byte)| byte ^ obfuscation_byte(index))
            .collect::<Vec<_>>();
        let mut bytes = MAGIC.to_vec();
        bytes.push(SCHEMA_VERSION);
        bytes.push(0);
        bytes.extend_from_slice(&(psoftware.len() as u16).to_le_bytes());
        bytes.extend_from_slice(&(pserver.len() as u16).to_le_bytes());
        bytes.extend(payload);
        bytes
    }

    #[test]
    fn decodes_matching_product() {
        let url = decode(
            Product::PSoftware,
            &encoded(
                "http://127.0.0.1:8080/psoftware/latest.json",
                "http://127.0.0.1:8080/pserver/latest.json",
            ),
        )
        .unwrap();
        assert_eq!(url.path(), "/psoftware/latest.json");
    }

    #[test]
    fn decodes_server_url() {
        let url = decode(
            Product::PServer,
            &encoded(
                "http://127.0.0.1:8080/psoftware/latest.json",
                "http://127.0.0.1:8080/pserver/latest.json",
            ),
        )
        .unwrap();
        assert_eq!(url.path(), "/pserver/latest.json");
    }

    #[test]
    fn accepts_configured_http_server() {
        let url = decode(
            Product::PSoftware,
            &encoded(
                "http://updates.example.com/psoftware/latest.json",
                "http://127.0.0.1:8080/pserver/latest.json",
            ),
        )
        .unwrap();
        assert_eq!(url.host_str(), Some("updates.example.com"));
    }

    #[test]
    fn bundled_configuration_signature_is_valid() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(FILE_NAME);
        let bytes = read_verified(&path).unwrap();
        decode(Product::PSoftware, &bytes).unwrap();
        decode(Product::PServer, &bytes).unwrap();
    }
}
