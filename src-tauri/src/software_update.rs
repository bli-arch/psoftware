use crate::{deployment, product_config};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Updater, UpdaterExt};

const STAGED_DIRECTORY: &str = "updates";
const STAGED_PACKAGE: &str = "psoftware-update.bin";
const STAGED_METADATA: &str = "psoftware-update.json";

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareUpdate {
    version: String,
    notes: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct StagedUpdate {
    version: String,
    notes: Option<String>,
    signature: String,
}

pub async fn check(app: AppHandle) -> Result<Option<SoftwareUpdate>, String> {
    let update = updater(&app)?
        .check()
        .await
        .map_err(|error| format!("Impossible de vérifier les mises à jour: {error}"))?;

    Ok(update.map(update_summary))
}

pub async fn prepare(app: AppHandle) -> Result<Option<SoftwareUpdate>, String> {
    let Some(update) = updater(&app)?
        .check()
        .await
        .map_err(|error| format!("Impossible de vérifier les mises à jour: {error}"))?
    else {
        clear_staged(&app);
        return Ok(None);
    };

    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|error| format!("Impossible de télécharger la mise à jour: {error}"))?;
    product_config::verify_signature(&bytes, &update.signature)
        .map_err(|error| format!("Mise à jour non authentique: {error}"))?;

    let metadata = StagedUpdate {
        version: update.version.clone(),
        notes: update.body.clone(),
        signature: update.signature.clone(),
    };
    write_staged(&app, &metadata, &bytes)?;
    Ok(Some(update_summary(update)))
}

pub async fn install(app: AppHandle) -> Result<Option<SoftwareUpdate>, String> {
    let Some(update) = updater(&app)?
        .check()
        .await
        .map_err(|error| format!("Impossible de vérifier les mises à jour: {error}"))?
    else {
        return Ok(None);
    };

    let result = update_summary(update.clone());
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| format!("Impossible d'installer la mise à jour: {error}"))?;
    Ok(Some(result))
}

pub fn pending(app: &AppHandle) -> Result<Option<SoftwareUpdate>, String> {
    let metadata = match read_staged_metadata(app) {
        Ok(Some(metadata)) => metadata,
        Ok(None) => {
            clear_staged(app);
            return Ok(None);
        }
        Err(error) => {
            clear_staged(app);
            return Err(error);
        }
    };

    let current = Version::parse(&app.package_info().version.to_string())
        .map_err(|error| format!("Version actuelle invalide: {error}"))?;
    let target = Version::parse(&metadata.version)
        .map_err(|error| format!("Version préparée invalide: {error}"))?;
    if current >= target {
        clear_staged(app);
        return Ok(None);
    }

    Ok(Some(SoftwareUpdate {
        version: metadata.version,
        notes: metadata.notes,
    }))
}

pub async fn apply_staged(app: AppHandle) -> Result<Option<SoftwareUpdate>, String> {
    let Some(metadata) = read_staged_metadata(&app)? else {
        return Ok(None);
    };
    if pending(&app)?.is_none() {
        return Ok(None);
    }

    let (_, package_path) = staged_paths(&app)?;
    let bytes = fs::read(&package_path)
        .map_err(|error| format!("Impossible de lire la mise à jour préparée: {error}"))?;
    product_config::verify_signature(&bytes, &metadata.signature)
        .map_err(|error| format!("Mise à jour préparée non authentique: {error}"))?;

    let Some(update) = updater(&app)?
        .check()
        .await
        .map_err(|error| format!("Impossible de vérifier la mise à jour préparée: {error}"))?
    else {
        return Err("La mise à jour préparée n’est plus proposée par le serveur.".into());
    };
    if update.version != metadata.version || update.signature != metadata.signature {
        return Err("La mise à jour préparée ne correspond plus à la version publiée.".into());
    }
    product_config::verify_signature(&bytes, &update.signature)
        .map_err(|error| format!("Mise à jour préparée non authentique: {error}"))?;

    update
        .install(&bytes)
        .map_err(|error| format!("Impossible d'appliquer la mise à jour: {error}"))?;
    clear_staged(&app);
    app.restart();
}

fn updater(app: &AppHandle) -> Result<Updater, String> {
    let endpoint = deployment::server_url("psoftware/latest.json")?;
    app.updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|error| format!("Configuration de mise à jour invalide: {error}"))?
        .build()
        .map_err(|error| format!("Impossible de préparer la mise à jour: {error}"))
}

fn update_summary(update: tauri_plugin_updater::Update) -> SoftwareUpdate {
    SoftwareUpdate {
        version: update.version,
        notes: update.body,
    }
}

fn staged_paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Impossible de localiser les mises à jour préparées: {error}"))?
        .join(STAGED_DIRECTORY);
    Ok((
        directory.join(STAGED_METADATA),
        directory.join(STAGED_PACKAGE),
    ))
}

fn write_staged(app: &AppHandle, metadata: &StagedUpdate, bytes: &[u8]) -> Result<(), String> {
    let (metadata_path, package_path) = staged_paths(app)?;
    let directory = metadata_path
        .parent()
        .ok_or("Dossier de mise à jour invalide.")?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Impossible de préparer le dossier des mises à jour: {error}"))?;
    write_atomic(&package_path, bytes)?;
    let metadata_bytes = serde_json::to_vec(metadata)
        .map_err(|error| format!("Impossible d'enregistrer la mise à jour préparée: {error}"))?;
    write_atomic(&metadata_path, &metadata_bytes)
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes)
        .map_err(|error| format!("Impossible d'écrire {}: {error}", path.display()))?;
    let _ = fs::remove_file(path);
    fs::rename(&temporary, path)
        .map_err(|error| format!("Impossible de finaliser {}: {error}", path.display()))
}

fn read_staged_metadata(app: &AppHandle) -> Result<Option<StagedUpdate>, String> {
    let (metadata_path, package_path) = staged_paths(app)?;
    if !metadata_path.is_file() || !package_path.is_file() {
        return Ok(None);
    }
    let raw = fs::read(&metadata_path)
        .map_err(|error| format!("Impossible de lire la mise à jour préparée: {error}"))?;
    serde_json::from_slice(&raw)
        .map(Some)
        .map_err(|error| format!("Mise à jour préparée invalide: {error}"))
}

fn clear_staged(app: &AppHandle) {
    if let Ok((metadata_path, package_path)) = staged_paths(app) {
        let _ = fs::remove_file(metadata_path);
        let _ = fs::remove_file(package_path);
    }
}
