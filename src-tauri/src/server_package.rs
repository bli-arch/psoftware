use crate::{deployment, product_config, server_service};
use reqwest::StatusCode;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

pub(crate) struct LicensedPackage {
    pub version: String,
    download_url: reqwest::Url,
    sha256: String,
    signature: String,
}

pub(crate) fn latest_licensed(license_key: &str) -> Result<LicensedPackage, String> {
    let license_key = validate_license_key(license_key)?;
    let manifest = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Impossible de préparer la lecture de latest.json : {error}"))?
        .get(deployment::server_url("pserver/latest.json")?)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .map_err(|_| {
            "Impossible de contacter le serveur de mise à jour (code:PSERVER_UPDATE_UNAVAILABLE)."
                .to_string()
        })?
        .error_for_status()
        .map_err(|error| format!("latest.json est indisponible : {error}"))?
        .json::<Value>()
        .map_err(|error| format!("latest.json est invalide : {error}"))?;

    licensed_from_manifest(license_key, &manifest)
}

pub(crate) fn ensure_available(package: &LicensedPackage) -> Result<(), String> {
    let response = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "Impossible de préparer la vérification de la licence.".to_string())?
        .head(package.download_url.clone())
        .send()
        .map_err(|_| "Impossible de contacter le serveur de licences.".to_string())?;

    if response.status().is_success() {
        Ok(())
    } else if response.status() == StatusCode::NOT_FOUND {
        Err(license_refused(package))
    } else {
        Err(format!(
            "Vérification de la licence impossible : HTTP {}.",
            response.status()
        ))
    }
}

pub(crate) fn download_verified(
    package: &LicensedPackage,
    expected_sha256: Option<&str>,
    target: &Path,
) -> Result<(), String> {
    let _ = fs::remove_file(target);
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| format!("Impossible de créer le client de téléchargement : {error}"))?;
    let mut response = client
        .get(package.download_url.clone())
        .send()
        .map_err(|error| format!("Téléchargement PServer impossible : {error}"))?;
    if response.status() == StatusCode::NOT_FOUND {
        return Err(license_refused(package));
    }
    if !response.status().is_success() {
        return Err(format!(
            "Téléchargement PServer refusé par le serveur : HTTP {}.",
            response.status()
        ));
    }

    let mut file = fs::File::create(target)
        .map_err(|error| format!("Impossible de créer le package PServer : {error}"))?;
    let bytes = response
        .copy_to(&mut file)
        .map_err(|error| format!("Impossible d'écrire le package PServer : {error}"))?;
    drop(file);
    if bytes == 0 {
        let _ = fs::remove_file(target);
        return Err("Téléchargement PServer vide.".into());
    }

    if let Some(expected) = expected_sha256
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if !expected.eq_ignore_ascii_case(&package.sha256) {
            return Err("Le SHA-256 attendu ne correspond pas à latest.json.".into());
        }
    }
    verify(target, &package.sha256, &package.signature)
}

pub(crate) fn verify(path: &Path, expected_sha256: &str, signature: &str) -> Result<(), String> {
    let package = fs::read(path)
        .map_err(|error| format!("Impossible de lire le package PServer signé : {error}"))?;
    let actual_sha256 = format!("{:x}", Sha256::digest(&package));
    if !actual_sha256.eq_ignore_ascii_case(expected_sha256.trim()) {
        return Err("Le SHA-256 du package PServer ne correspond pas au manifest.".into());
    }
    product_config::verify_signature(&package, signature)
        .map_err(|_| "La signature du package PServer est invalide.".to_string())
}

fn licensed_from_manifest(license_key: &str, manifest: &Value) -> Result<LicensedPackage, String> {
    let license_key = validate_license_key(license_key)?;
    let version = manifest
        .get("version")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "latest.json ne contient pas de version PServer.".to_string())?;
    semver::Version::parse(normalize_version(version))
        .map_err(|_| "La version PServer de latest.json est invalide.".to_string())?;

    let platform = manifest
        .pointer("/platforms/windows-x86_64")
        .ok_or_else(|| "latest.json ne contient pas de package Windows x64.".to_string())?;
    let artifact_url = platform
        .get("url")
        .and_then(Value::as_str)
        .and_then(|value| reqwest::Url::parse(value).ok())
        .ok_or_else(|| "L'URL du package PServer dans latest.json est invalide.".to_string())?;
    let filename = artifact_url
        .path_segments()
        .and_then(|mut segments| segments.next_back())
        .filter(|value| {
            !value.is_empty()
                && value.ends_with("_x64-setup.exe")
                && value.chars().all(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_')
                })
        })
        .ok_or_else(|| "Le nom du package PServer dans latest.json est invalide.".to_string())?;
    let sha256 = platform
        .get("sha256")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| {
            value.len() == 64 && value.chars().all(|character| character.is_ascii_hexdigit())
        })
        .ok_or_else(|| "Le SHA-256 du package PServer est absent ou invalide.".to_string())?;
    let signature = platform
        .get("signature")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "La signature du package PServer est absente.".to_string())?;

    Ok(LicensedPackage {
        version: version.to_string(),
        download_url: deployment::server_url(&format!("license/{license_key}/{filename}"))?,
        sha256: sha256.to_ascii_lowercase(),
        signature: signature.to_string(),
    })
}

fn validate_license_key(license_key: &str) -> Result<&str, String> {
    let key = license_key.trim();
    if key.is_empty() {
        return Err("La clé de licence est obligatoire.".into());
    }
    if !key
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err("La clé de licence contient des caractères invalides.".into());
    }
    Ok(key)
}

fn normalize_version(version: &str) -> &str {
    version.trim().trim_start_matches('v')
}

fn license_refused(package: &LicensedPackage) -> String {
    format!(
        "Cette clé de licence n'autorise pas PServer {}.",
        package.version
    )
}

pub(crate) fn extract_executable(installer: &Path) -> Result<PathBuf, String> {
    let executable = installer
        .parent()
        .ok_or_else(|| "Le dossier du package PServer est invalide.".to_string())?
        .join("PServer.package.exe");
    if executable.exists() {
        fs::remove_file(&executable)
            .map_err(|error| format!("Impossible de nettoyer l'extraction PServer : {error}"))?;
    }

    run_installer(
        installer,
        ["/S".to_string(), "/PSERVER-EXTRACT=1".to_string()],
        "Impossible d'extraire le package PServer",
    )?;

    if executable.is_file() {
        Ok(executable)
    } else {
        Err("Le package PServer n'a pas produit PServer.exe.".into())
    }
}

pub(crate) fn install(installer: &Path) -> Result<(), String> {
    run_installer(
        installer,
        ["/S".to_string(), "/PSERVER-MANAGED=1".to_string()],
        "L'installation du package PServer a échoué",
    )
}

fn run_installer<const N: usize>(
    installer: &Path,
    arguments: [String; N],
    context: &str,
) -> Result<(), String> {
    let metadata = fs::metadata(installer)
        .map_err(|error| format!("Package PServer introuvable : {error}"))?;
    if !metadata.is_file() || metadata.len() < 1024 {
        return Err("Le package PServer est invalide.".into());
    }

    let mut command = Command::new(installer);
    command.args(arguments);
    hide_window(&mut command);
    let output = command
        .output()
        .map_err(|error| format!("{context} : {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "{context}. Code de sortie : {}. {}",
            output.status.code().unwrap_or(-1),
            server_service::command_output_text(&output)
        ))
    }
}

fn hide_window(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
}

#[cfg(test)]
mod tests {
    use super::licensed_from_manifest;
    use serde_json::json;

    fn manifest(url: &str) -> serde_json::Value {
        json!({
            "version": "1.2.3",
            "platforms": {
                "windows-x86_64": {
                    "url": url,
                    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                    "signature": "signed-package"
                }
            }
        })
    }

    #[test]
    fn license_path_uses_the_filename_from_latest_manifest() {
        let package = licensed_from_manifest(
            "CLIENT_01",
            &manifest("https://updates.example/pserver/PServer_1.2.3_x64-setup.exe"),
        )
        .unwrap();

        assert_eq!(package.version, "1.2.3");
        assert_eq!(
            package.download_url.path(),
            "/license/CLIENT_01/PServer_1.2.3_x64-setup.exe"
        );
    }

    #[test]
    fn license_path_rejects_an_unsafe_or_unexpected_filename() {
        assert!(licensed_from_manifest(
            "CLIENT_01",
            &manifest("https://updates.example/pserver/PServer%20setup.exe"),
        )
        .is_err());
        assert!(licensed_from_manifest(
            "../CLIENT",
            &manifest("https://updates.example/pserver/PServer_1.2.3_x64-setup.exe"),
        )
        .is_err());
    }
}
