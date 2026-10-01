use crate::{deployment, dpapi, product_config, server_installer, server_package, server_service};
use reqwest::Url;
use ring::aead;
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::Read;
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const BACKUP_KEY_SIZE: usize = 32;
const BACKUP_KEY_ENVELOPE_MAGIC: &[u8] = b"PSOFT-BACKUP-KEY\0\x01";
const BACKUP_KEY_MAX_SIZE: u64 = 64 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerUpdateCheckRequest {
    expected_server_id: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerUpdateInstallRequest {
    pub fresh_install: bool,
    pub expected_server_id: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerUpdateBackup {
    filename: String,
    sha256: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerUpdateCheckResult {
    configured: bool,
    available: bool,
    current_version: Option<String>,
    version: Option<String>,
    notes: Option<String>,
    detail: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerUpdateInstallResult {
    version: String,
    backup_path: String,
    fresh_install: bool,
    restarted: bool,
    detail: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ElevatedUpdateResult {
    ok: bool,
    result: Option<ServerUpdateInstallResult>,
    message: String,
}

#[derive(Clone)]
struct ServerUpdateManifest {
    version: String,
    notes: Option<String>,
    package_url: Url,
    sha256: String,
    signature: String,
}

struct ServerUpdateContext {
    install_dir: PathBuf,
    program_data_dir: PathBuf,
    config_directory: PathBuf,
    config_path: PathBuf,
    manifest_url: Url,
}

pub async fn check(request: ServerUpdateCheckRequest) -> Result<ServerUpdateCheckResult, String> {
    server_service::verify_local_server_id(&request.expected_server_id)?;
    let context = update_context(false)?;
    let manifest = fetch_manifest(&context.manifest_url).await?;
    let current_version = installed_server_version()?;
    let available = parse_server_version(&manifest.version, "Le manifest PServer")?
        > parse_server_version(&current_version, "La version installée de PServer")?;

    Ok(ServerUpdateCheckResult {
        configured: true,
        available,
        current_version: Some(current_version),
        version: Some(manifest.version.clone()),
        notes: manifest.notes,
        detail: if available {
            format!("La version PServer {} est disponible.", manifest.version)
        } else {
            "PServer est déjà à jour.".into()
        },
    })
}

pub async fn install(
    request: ServerUpdateInstallRequest,
) -> Result<ServerUpdateInstallResult, String> {
    if !cfg!(target_os = "windows") {
        return Err(
            "La mise à jour locale de PServer est disponible uniquement sur Windows.".into(),
        );
    }

    if !request.fresh_install {
        server_service::verify_local_server_id(&request.expected_server_id)?;
    }

    if !server_service::is_elevated() {
        return run_elevated_update(&request);
    }

    install_elevated(request).await
}

pub(crate) fn handle_elevated_update_args() -> bool {
    let args: Vec<String> = env::args().collect();
    let Some(request_path) = arg_value(&args, "--pserver-update-request") else {
        return false;
    };
    let Some(result_path) = arg_value(&args, "--pserver-update-result") else {
        return false;
    };

    let result = fs::read_to_string(&request_path)
        .map_err(|error| format!("Impossible de lire la demande de mise à jour: {error}"))
        .and_then(|raw| {
            serde_json::from_str::<ServerUpdateInstallRequest>(&raw)
                .map_err(|error| format!("Demande de mise à jour invalide: {error}"))
        })
        .and_then(|request| {
            tokio::runtime::Runtime::new()
                .map_err(|error| format!("Impossible de préparer la mise à jour: {error}"))?
                .block_on(install_elevated(request))
        });

    let payload = match result {
        Ok(result) => ElevatedUpdateResult {
            message: result.detail.clone(),
            ok: true,
            result: Some(result),
        },
        Err(message) => ElevatedUpdateResult {
            ok: false,
            result: None,
            message,
        },
    };

    if let Ok(raw) = serde_json::to_string(&payload) {
        let _ = fs::write(&result_path, raw);
    }

    let _ = fs::remove_file(&request_path);
    std::process::exit(if payload.ok { 0 } else { 1 });
}

async fn install_elevated(
    request: ServerUpdateInstallRequest,
) -> Result<ServerUpdateInstallResult, String> {
    if !request.fresh_install {
        server_service::verify_local_server_id(&request.expected_server_id)?;
    }
    let context = update_context(true)?;
    harden_server_data_directories(&context)?;
    if !request.fresh_install {
        let config_directory = context
            .config_path
            .parent()
            .ok_or_else(|| "Dossier de configuration PServer invalide.".to_string())?;
        server_service::harden_server_directory(config_directory)?;
    }
    let manifest = fetch_manifest(&context.manifest_url).await?;

    if !request.fresh_install {
        let current_version = installed_server_version()?;
        if parse_server_version(&manifest.version, "Le manifest PServer")?
            <= parse_server_version(&current_version, "La version installée de PServer")?
        {
            return Err("Aucune mise à jour PServer n'est disponible.".into());
        }
    }

    let work_dir = prepare_work_dir(&manifest.version)?;
    let package_path = work_dir.join(format!(
        "PServer-{}-setup.exe",
        sanitize_path_part(&manifest.version)
    ));
    download_package(&manifest.package_url, &package_path).await?;
    server_package::verify(&package_path, &manifest.sha256, &manifest.signature)?;
    let package_executable = server_package::extract_executable(&package_path)?;
    verify_executable_version(
        &package_executable,
        &manifest.version,
        "La version du package PServer téléchargé",
    )?;
    let prepared_backup = if request.fresh_install {
        None
    } else {
        let backup = create_local_pre_update_backup(&context, &package_executable)?;
        Some(validate_pre_update_backup(&context, &backup)?)
    };
    if !request.fresh_install {
        product_config::install_bundled(&context.config_directory)?;
    }

    stop_service_for_update()?;
    let mut backup_path = match install_package_contents(
        &request,
        &context,
        &package_path,
        &manifest,
        prepared_backup.as_deref(),
    ) {
        Ok(backup_path) => backup_path,
        Err(error) => {
            if !request.fresh_install {
                let _ = server_service::run_service_command("start");
            }
            return Err(error);
        }
    };
    let firewall_warning = if request.fresh_install {
        product_config::install_bundled(&context.config_directory)?;
        None
    } else {
        server_installer::configure_existing_server_firewall(
            &context
                .install_dir
                .join(server_service::SERVER_EXECUTABLE_NAME),
            &context.config_path,
        )
        .err()
    };
    let restarted = if request.fresh_install {
        false
    } else {
        server_service::start().map_err(|error| {
            format!(
                "{error} La sauvegarde de restauration est conservée dans {}.",
                backup_path.display()
            )
        })?;
        let (health_origin, ca_path) =
            configured_health_target(&context.config_path, &context.config_directory).map_err(
                |error| {
                    format!(
                        "{error} La sauvegarde de restauration est conservée dans {}.",
                        backup_path.display()
                    )
                },
            )?;
        server_installer::wait_for_health(&health_origin, &ca_path, Duration::from_secs(45))
            .map_err(|error| {
                format!(
                    "{error} La sauvegarde de restauration est conservée dans {}.",
                    backup_path.display()
                )
            })?;
        true
    };
    let backup_cleanup_warning = if request.fresh_install {
        prepared_backup
            .as_deref()
            .and_then(|path| remove_successful_update_backup(path).err())
    } else {
        let mut warnings = Vec::new();
        match remove_successful_update_backup(&backup_path) {
            Ok(()) => backup_path = PathBuf::new(),
            Err(error) => warnings.push(error),
        }
        if let Err(error) = remove_legacy_update_backups(&context.program_data_dir) {
            warnings.push(error);
        }
        if warnings.is_empty() {
            None
        } else {
            Some(warnings.join(" "))
        }
    };

    let mut detail = if restarted {
        format!("PServer {} a été installé et redémarré.", manifest.version)
    } else {
        format!(
            "PServer {} a été installé. La configuration précédente a été mise de côté.",
            manifest.version
        )
    };
    if let Some(warning) = firewall_warning {
        detail.push_str(&format!(
            " Attention : le pare-feu Windows doit être configuré manuellement. {warning}"
        ));
    }
    if let Some(warning) = backup_cleanup_warning {
        detail.push_str(&format!(" Attention : {warning}"));
    }

    Ok(ServerUpdateInstallResult {
        version: manifest.version.clone(),
        backup_path: backup_path.display().to_string(),
        fresh_install: request.fresh_install,
        restarted,
        detail,
    })
}

fn install_package_contents(
    request: &ServerUpdateInstallRequest,
    context: &ServerUpdateContext,
    package_path: &Path,
    manifest: &ServerUpdateManifest,
    prepared_backup: Option<&Path>,
) -> Result<PathBuf, String> {
    let backup_path = if request.fresh_install {
        let backup_path = backup_server_state(context)?;
        move_active_server_state(context, &backup_path)?;
        backup_path
    } else {
        prepared_backup
            .ok_or_else(|| {
                "La sauvegarde chiffrée préalable à la mise à jour est absente.".to_string()
            })?
            .to_path_buf()
    };

    server_package::install(package_path)?;

    verify_installed_version(&context.install_dir, &manifest.version)?;

    Ok(backup_path)
}

fn run_elevated_update(
    request: &ServerUpdateInstallRequest,
) -> Result<ServerUpdateInstallResult, String> {
    let current_exe =
        env::current_exe().map_err(|error| format!("Impossible de localiser PSoft: {error}"))?;
    let (request_path, result_path) = temp_update_paths();
    let raw = serde_json::to_string(request)
        .map_err(|error| format!("Impossible de préparer la mise à jour: {error}"))?;

    fs::write(&request_path, raw)
        .map_err(|error| format!("Impossible de préparer la mise à jour: {error}"))?;

    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         try {{ \
             $process = Start-Process -WindowStyle Hidden -FilePath {exe} -ArgumentList @('--pserver-update-request', {request}, '--pserver-update-result', {result}) -Verb RunAs -Wait -PassThru; \
         }} catch {{ exit 1223 }}; \
         if ($null -eq $process) {{ exit 1223 }}; \
         exit $process.ExitCode",
        exe = server_service::single_quote(&current_exe.to_string_lossy()),
        request = server_service::single_quote(&request_path.to_string_lossy()),
        result = server_service::single_quote(&result_path.to_string_lossy()),
    );

    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        &script,
    ]);
    hide_window(&mut command);

    let status = command
        .status()
        .map_err(|error| format!("Impossible de demander l'autorisation administrateur: {error}"));

    let result = fs::read_to_string(&result_path)
        .ok()
        .and_then(|value| serde_json::from_str::<ElevatedUpdateResult>(&value).ok());

    let _ = fs::remove_file(&request_path);
    let _ = fs::remove_file(&result_path);

    let status = status?;
    if status.code() == Some(1223) {
        return Err("Mise à jour annulée: autorisation administrateur refusée.".into());
    }

    if let Some(result) = result {
        return if result.ok {
            Ok(result
                .result
                .unwrap_or_else(|| fallback_elevated_result(request)))
        } else {
            Err(result.message)
        };
    }

    if status.success() {
        return Ok(fallback_elevated_result(request));
    }

    Err(format!(
        "Mise à jour PServer échouée. Code de sortie: {}.",
        status.code().unwrap_or(-1)
    ))
}

fn temp_update_paths() -> (PathBuf, PathBuf) {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0);
    let base = format!("psoft-pserver-update-{}-{stamp}", std::process::id());
    let temp_dir = env::temp_dir();
    (
        temp_dir.join(format!("{base}.json")),
        temp_dir.join(format!("{base}.result.json")),
    )
}

fn fallback_elevated_result(request: &ServerUpdateInstallRequest) -> ServerUpdateInstallResult {
    ServerUpdateInstallResult {
        version: String::new(),
        backup_path: String::new(),
        fresh_install: request.fresh_install,
        restarted: !request.fresh_install,
        detail: "Mise à jour PServer terminée.".into(),
    }
}

fn arg_value(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|arg| arg == name)
        .and_then(|index| args.get(index + 1))
        .cloned()
}

fn update_context(require_elevated: bool) -> Result<ServerUpdateContext, String> {
    if !cfg!(target_os = "windows") {
        return Err(
            "La mise à jour locale de PServer est disponible uniquement sur Windows.".into(),
        );
    }

    let executable_path = server_service::server_executable_path()
        .ok_or_else(|| "PServer.exe n'est pas installé sur cette machine.".to_string())?;

    if require_elevated && !server_service::is_elevated() {
        return Err("Lancez PSoft en tant qu'administrateur pour mettre PServer à jour.".into());
    }

    let install_dir = executable_path
        .parent()
        .ok_or_else(|| "Impossible d'identifier le dossier d'installation PServer.".to_string())?
        .to_path_buf();
    let program_data_dir = server_service::program_data_dir()?;
    let config_directory = program_data_dir.join("config");
    let config_path = config_directory.join("server.toml");
    let manifest_url = deployment::server_url("pserver/latest.json")?;

    Ok(ServerUpdateContext {
        install_dir,
        program_data_dir,
        config_directory,
        config_path,
        manifest_url,
    })
}

async fn fetch_manifest(manifest_url: &Url) -> Result<ServerUpdateManifest, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Impossible de préparer la requête de mise à jour: {error}"))?;
    let payload = client
        .get(manifest_url.clone())
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| format!("Impossible de charger le manifest PServer: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Manifest PServer indisponible: {error}"))?
        .json::<Value>()
        .await
        .map_err(|error| format!("Manifest PServer invalide: {error}"))?;

    normalize_manifest(payload)
}

fn normalize_manifest(value: Value) -> Result<ServerUpdateManifest, String> {
    let version = read_json_string(&value, "version")
        .or_else(|| read_json_string(&value, "latestVersion"))
        .ok_or_else(|| "Le manifest PServer ne contient pas de version.".to_string())?;
    let notes = read_json_string(&value, "notes")
        .or_else(|| read_json_string(&value, "body"))
        .or_else(|| read_json_string(&value, "releaseNotes"));

    let package = find_package(&value)
        .ok_or_else(|| "Le manifest PServer ne contient pas de package Windows x64.".to_string())?;
    let package_url = read_json_string(package, "url")
        .or_else(|| read_json_string(package, "downloadUrl"))
        .ok_or_else(|| "Le package PServer ne contient pas d'URL.".to_string())
        .and_then(|url| validate_update_url(&url))?;
    let sha256 = read_json_string(package, "sha256")
        .or_else(|| read_json_string(package, "hash"))
        .ok_or_else(|| "Le package PServer ne contient pas de SHA-256.".to_string())?;
    let signature = read_json_string(package, "signature")
        .ok_or_else(|| "Le package PServer ne contient pas de signature.".to_string())?;

    validate_sha256_format(&sha256)?;

    Ok(ServerUpdateManifest {
        version,
        notes,
        package_url,
        sha256,
        signature,
    })
}

fn find_package(value: &Value) -> Option<&Value> {
    let candidates = [
        Some(value),
        value.pointer("/windows/x86_64"),
        value.pointer("/windows/x86_64-pc-windows-msvc"),
        value.pointer("/platforms/windows"),
        value.pointer("/platforms/windows-x86_64"),
        value.pointer("/platforms/windows-x86_64-pc-windows-msvc"),
        value.pointer("/packages/windows"),
        value.pointer("/packages/windows-x86_64"),
        value.pointer("/packages/windows-x86_64-pc-windows-msvc"),
    ];

    candidates.into_iter().flatten().find(|candidate| {
        read_json_string(candidate, "url")
            .or_else(|| read_json_string(candidate, "downloadUrl"))
            .is_some()
    })
}

async fn download_package(url: &Url, target: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| format!("Impossible de préparer le téléchargement PServer: {error}"))?;
    let bytes = client
        .get(url.clone())
        .send()
        .await
        .map_err(|error| format!("Impossible de télécharger PServer: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Package PServer indisponible: {error}"))?
        .bytes()
        .await
        .map_err(|error| format!("Package PServer illisible: {error}"))?;

    fs::write(target, bytes)
        .map_err(|error| format!("Impossible d'enregistrer le package PServer: {error}"))
}

fn stop_service_for_update() -> Result<(), String> {
    match server_service::run_service_command("stop") {
        Ok(()) => server_service::wait_for_service_state("stopped", Duration::from_secs(30)),
        Err(error) => {
            let normalized = error.to_ascii_lowercase();
            if normalized.contains("stopped") || normalized.contains("not running") {
                Ok(())
            } else {
                Err(error)
            }
        }
    }
}

fn backup_server_state(context: &ServerUpdateContext) -> Result<PathBuf, String> {
    let backup_dir = context
        .program_data_dir
        .join("update-backups")
        .join(format!("pre-update-{}", timestamp()));
    fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("Impossible de créer la sauvegarde PServer: {error}"))?;

    copy_if_exists(&context.config_path, &backup_dir.join("server.toml"))?;

    for (name, path) in configured_data_paths(context) {
        copy_if_exists(&path, &backup_dir.join(name))?;
    }

    Ok(backup_dir)
}

fn create_local_pre_update_backup(
    context: &ServerUpdateContext,
    executable_path: &Path,
) -> Result<ServerUpdateBackup, String> {
    let mut command = Command::new(executable_path);
    command
        .arg("backup-pre-update")
        .arg("--config")
        .arg(&context.config_path);
    hide_window(&mut command);

    let output = command.output().map_err(|error| {
        format!(
            "Impossible de lancer la sauvegarde locale avec {}: {error}",
            executable_path.display()
        )
    })?;
    if !output.status.success() {
        return Err(format!(
            "Impossible de créer la sauvegarde locale préalable à la mise à jour. {}",
            server_service::command_output_text(&output)
        ));
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Sauvegarde locale préalable à la mise à jour invalide: {error}"))
}

fn validate_pre_update_backup(
    context: &ServerUpdateContext,
    backup: &ServerUpdateBackup,
) -> Result<PathBuf, String> {
    let backup_key = require_exported_backup_key(context)?;
    let filename = backup.filename.trim();
    let valid_name = filename == backup.filename
        && Path::new(filename)
            .file_name()
            .and_then(|name| name.to_str())
            == Some(filename)
        && !filename.contains(['/', '\\'])
        && is_update_backup_filename(filename);
    if !valid_name {
        return Err("Le nom de la sauvegarde préalable à la mise à jour est invalide.".into());
    }
    validate_sha256_format(&backup.sha256)?;

    let configured_backup_dir = configured_path(
        context,
        "backup_dir",
        context.program_data_dir.join("backups"),
    );
    if !configured_backup_dir.is_absolute() {
        return Err("Le dossier des sauvegardes PServer doit utiliser un chemin absolu.".into());
    }
    let backup_dir = fs::canonicalize(&configured_backup_dir).map_err(|error| {
        format!(
            "Impossible de contrôler le dossier des sauvegardes PServer {}: {error}",
            configured_backup_dir.display()
        )
    })?;
    let backup_path = backup_dir.join(filename);
    let metadata = fs::symlink_metadata(&backup_path).map_err(|error| {
        format!("La sauvegarde chiffrée préalable à la mise à jour est introuvable: {error}")
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() || metadata.len() != backup.size {
        return Err("La sauvegarde chiffrée préalable à la mise à jour est invalide.".into());
    }
    if metadata
        .modified()
        .ok()
        .and_then(|modified| SystemTime::now().duration_since(modified).ok())
        .is_some_and(|age| age > Duration::from_secs(30 * 60))
    {
        return Err(
            "La sauvegarde préalable à la mise à jour a expiré. Relancez l'installation.".into(),
        );
    }

    let sidecar_path = backup_path.with_file_name(format!("{filename}.sha256"));
    let sidecar_metadata = fs::symlink_metadata(&sidecar_path)
        .map_err(|error| format!("La preuve d'intégrité de la sauvegarde est absente: {error}"))?;
    if sidecar_metadata.file_type().is_symlink() || !sidecar_metadata.is_file() {
        return Err("La preuve d'intégrité de la sauvegarde est invalide.".into());
    }
    let expected_hash = backup.sha256.trim().to_ascii_lowercase();
    let sidecar_hash = fs::read_to_string(&sidecar_path)
        .map_err(|error| format!("Impossible de lire la preuve d'intégrité: {error}"))?
        .trim()
        .to_ascii_lowercase();
    if sidecar_hash != expected_hash || file_sha256(&backup_path)? != expected_hash {
        return Err("L'intégrité de la sauvegarde préalable à la mise à jour est invalide.".into());
    }

    verify_encrypted_backup(&backup_path, &backup_key)?;

    Ok(backup_path)
}

fn require_exported_backup_key(context: &ServerUpdateContext) -> Result<Vec<u8>, String> {
    let key_path = context.config_directory.join("backup.key");
    let marker_path = context.config_directory.join("backup.key.exported");
    let key_metadata = fs::symlink_metadata(&key_path).map_err(|_| {
        "Exportez la clé de récupération avant d'installer une mise à jour PServer.".to_string()
    })?;
    let marker_metadata = fs::symlink_metadata(&marker_path).map_err(|_| {
        "Exportez la clé de récupération avant d'installer une mise à jour PServer.".to_string()
    })?;
    if key_metadata.file_type().is_symlink()
        || !key_metadata.is_file()
        || key_metadata.len() == 0
        || key_metadata.len() > BACKUP_KEY_MAX_SIZE
        || marker_metadata.file_type().is_symlink()
        || !marker_metadata.is_file()
        || fs::read_to_string(&marker_path)
            .map(|value| value.trim().is_empty())
            .unwrap_or(true)
    {
        return Err(
            "Exportez la clé de récupération avant d'installer une mise à jour PServer.".into(),
        );
    }
    let stored = fs::read(&key_path)
        .map_err(|error| format!("Impossible de lire la clé de sauvegarde: {error}"))?;
    decode_stored_backup_key(&stored)
}

fn decode_stored_backup_key(stored: &[u8]) -> Result<Vec<u8>, String> {
    if stored.len() == BACKUP_KEY_SIZE {
        return Ok(stored.to_vec());
    }
    let protected = stored
        .strip_prefix(BACKUP_KEY_ENVELOPE_MAGIC)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "La clé de sauvegarde protégée est invalide.".to_string())?;
    let key = dpapi::unprotect(protected).map_err(|_| {
        "La clé de sauvegarde ne peut pas être déchiffrée sur cette machine.".to_string()
    })?;
    if key.len() != BACKUP_KEY_SIZE {
        return Err("La clé de sauvegarde protégée est invalide.".into());
    }
    Ok(key)
}

fn verify_encrypted_backup(path: &Path, key: &[u8]) -> Result<(), String> {
    const MAGIC: &[u8] = b"PSOFT-BACKUP\0\x01";
    const CHUNK_SIZE: usize = 1024 * 1024;

    let unbound_key = aead::UnboundKey::new(&aead::AES_256_GCM, key)
        .map_err(|_| "La clé de sauvegarde est invalide.".to_string())?;
    let key = aead::LessSafeKey::new(unbound_key);
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Impossible de lire la sauvegarde chiffrée: {error}"))?;
    let mut header = vec![0_u8; MAGIC.len() + 8];
    file.read_exact(&mut header)
        .map_err(|error| format!("Sauvegarde chiffrée illisible: {error}"))?;
    if &header[..MAGIC.len()] != MAGIC {
        return Err("Le format de la sauvegarde préalable à la mise à jour est invalide.".into());
    }

    let mut counter = 0_u32;
    loop {
        let mut size_bytes = [0_u8; 4];
        file.read_exact(&mut size_bytes)
            .map_err(|_| "La sauvegarde chiffrée est tronquée.".to_string())?;
        let sealed_size = u32::from_be_bytes(size_bytes) as usize;
        if sealed_size < aead::AES_256_GCM.tag_len()
            || sealed_size > CHUNK_SIZE + aead::AES_256_GCM.tag_len()
        {
            return Err("La taille d'un bloc de sauvegarde est invalide.".into());
        }

        let mut sealed = vec![0_u8; sealed_size];
        file.read_exact(&mut sealed)
            .map_err(|_| "La sauvegarde chiffrée est tronquée.".to_string())?;
        let counter_bytes = counter.to_be_bytes();
        let mut nonce = [0_u8; 12];
        nonce[..8].copy_from_slice(&header[MAGIC.len()..]);
        nonce[8..].copy_from_slice(&counter_bytes);
        let mut associated_data = Vec::with_capacity(MAGIC.len() + counter_bytes.len());
        associated_data.extend_from_slice(MAGIC);
        associated_data.extend_from_slice(&counter_bytes);
        let plain = key
            .open_in_place(
                aead::Nonce::assume_unique_for_key(nonce),
                aead::Aad::from(associated_data),
                &mut sealed,
            )
            .map_err(|_| {
                "La sauvegarde préalable à la mise à jour ne correspond pas à la clé exportée."
                    .to_string()
            })?;
        if plain.is_empty() {
            let mut extra = [0_u8; 1];
            if file.read(&mut extra).map_err(|error| {
                format!("Impossible de terminer la lecture de la sauvegarde: {error}")
            })? != 0
            {
                return Err("La sauvegarde contient des données après son dernier bloc.".into());
            }
            return Ok(());
        }
        counter = counter
            .checked_add(1)
            .ok_or_else(|| "La sauvegarde contient trop de blocs.".to_string())?;
    }
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Impossible de lire {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Impossible de lire {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn remove_successful_update_backup(backup_path: &Path) -> Result<(), String> {
    let valid_name = backup_path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(is_update_backup_filename);
    if !valid_name {
        return Err("le chemin de la sauvegarde de mise à jour est invalide.".into());
    }
    let metadata = fs::symlink_metadata(backup_path).map_err(|error| {
        format!("impossible de contrôler la sauvegarde de mise à jour: {error}")
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("la sauvegarde de mise à jour n'est pas un fichier valide.".into());
    }
    fs::remove_file(backup_path).map_err(|error| {
        format!(
            "impossible de supprimer la sauvegarde de mise à jour {}: {error}",
            backup_path.display()
        )
    })?;

    let sidecar_path = backup_path.with_file_name(format!(
        "{}.sha256",
        backup_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
    ));
    match fs::remove_file(&sidecar_path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "impossible de supprimer la preuve d'intégrité {}: {error}",
            sidecar_path.display()
        )),
    }
}

fn is_update_backup_filename(filename: &str) -> bool {
    filename.ends_with(".psoft-backup")
        && (filename.starts_with("psoft-pre-update-")
            || filename.starts_with("psoft-sqlite-")
            || filename.starts_with("psoft-postgres-"))
}

fn remove_legacy_update_backups(program_data_dir: &Path) -> Result<(), String> {
    let root = program_data_dir.join("update-backups");
    let root_metadata = match fs::symlink_metadata(&root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "impossible de contrôler les anciennes sauvegardes: {error}"
            ))
        }
    };
    if root_metadata.file_type().is_symlink() || !root_metadata.is_dir() {
        return Err("le dossier des anciennes sauvegardes de mise à jour est invalide.".into());
    }

    for entry in fs::read_dir(&root)
        .map_err(|error| format!("impossible de lire les anciennes sauvegardes: {error}"))?
    {
        let entry = entry.map_err(|error| format!("sauvegarde illisible: {error}"))?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };
        if !name.starts_with("pre-update-") {
            continue;
        }
        let metadata = fs::symlink_metadata(entry.path())
            .map_err(|error| format!("impossible de contrôler {name}: {error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(format!(
                "l'ancienne sauvegarde {name} n'est pas un dossier valide."
            ));
        }
        fs::remove_dir_all(entry.path())
            .map_err(|error| format!("impossible de supprimer {name}: {error}"))?;
    }

    if fs::read_dir(&root)
        .map_err(|error| format!("impossible de relire les anciennes sauvegardes: {error}"))?
        .next()
        .is_none()
    {
        fs::remove_dir(&root)
            .map_err(|error| format!("impossible de supprimer {}: {error}", root.display()))?;
    }
    Ok(())
}

fn configured_data_paths(context: &ServerUpdateContext) -> Vec<(&'static str, PathBuf)> {
    let data_dir = configured_path(context, "data_dir", context.program_data_dir.join("data"));
    let media_dir = configured_path(context, "media_dir", data_dir.join("media"));
    let static_dir = configured_path(
        context,
        "static_dir",
        context.program_data_dir.join("static"),
    );
    let log_dir = configured_path(context, "log_dir", context.program_data_dir.join("logs"));
    let mut paths = vec![
        ("data", data_dir.clone()),
        ("static", static_dir),
        ("logs", log_dir),
    ];

    if !media_dir.starts_with(&data_dir) {
        paths.push(("media", media_dir));
    }

    if let Some(sqlite_path) = read_config_value(&context.config_path, "database", "sqlite_path") {
        let sqlite_path = PathBuf::from(sqlite_path);
        if sqlite_path.is_file() {
            paths.push(("database.sqlite", sqlite_path));
        }
    }

    paths
}

fn harden_server_data_directories(context: &ServerUpdateContext) -> Result<(), String> {
    let data_dir = configured_path(context, "data_dir", context.program_data_dir.join("data"));
    let directories = [
        context.program_data_dir.clone(),
        data_dir.clone(),
        configured_path(context, "media_dir", data_dir.join("media")),
        configured_path(context, "log_dir", context.program_data_dir.join("logs")),
        configured_path(
            context,
            "backup_dir",
            context.program_data_dir.join("backups"),
        ),
        configured_path(context, "temp_dir", context.program_data_dir.join("tmp")),
    ];
    for directory in directories {
        server_service::harden_server_directory(&directory)?;
    }
    if let Some(sqlite_path) = read_config_value(&context.config_path, "database", "sqlite_path") {
        let parent = Path::new(&sqlite_path)
            .parent()
            .ok_or_else(|| "Le dossier de la base SQLite est invalide.".to_string())?;
        server_service::harden_server_directory(parent)?;
    }
    Ok(())
}

fn configured_path(context: &ServerUpdateContext, key: &str, fallback: PathBuf) -> PathBuf {
    read_config_value(&context.config_path, "paths", key)
        .map(PathBuf::from)
        .unwrap_or(fallback)
}

fn configured_health_target(
    config_path: &Path,
    config_directory: &Path,
) -> Result<(String, PathBuf), String> {
    let bind = read_config_value(config_path, "server", "bind")
        .unwrap_or_else(|| "127.0.0.1".into())
        .trim()
        .trim_matches(['[', ']'])
        .parse::<IpAddr>()
        .map_err(|_| "Adresse d'écoute PServer invalide dans server.toml.".to_string())?;
    if bind.is_multicast() {
        return Err("L'adresse d'écoute PServer ne peut pas être multicast.".into());
    }
    let port = read_config_value(config_path, "server", "port")
        .unwrap_or_else(|| "8000".into())
        .parse::<u16>()
        .ok()
        .filter(|port| *port != 0)
        .ok_or_else(|| "Port PServer invalide dans server.toml.".to_string())?;
    let host = if bind.is_unspecified() {
        if bind.is_ipv4() {
            "127.0.0.1".into()
        } else {
            "[::1]".into()
        }
    } else if bind.is_ipv6() {
        format!("[{bind}]")
    } else {
        bind.to_string()
    };
    let ca_path = read_config_value(config_path, "tls", "ca_file")
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| config_directory.join("certificates").join("psoft-ca.crt"));

    Ok((format!("https://{host}:{port}"), ca_path))
}

fn move_active_server_state(
    context: &ServerUpdateContext,
    backup_dir: &Path,
) -> Result<(), String> {
    let removed_dir = backup_dir.join("fresh-install-previous-state");
    fs::create_dir_all(&removed_dir)
        .map_err(|error| format!("Impossible de préparer la réinstallation propre: {error}"))?;

    move_if_exists(
        context.program_data_dir.join("config"),
        removed_dir.join("config"),
    )?;
    move_if_exists(
        context.program_data_dir.join("data"),
        removed_dir.join("data"),
    )?;
    move_if_exists(
        context.program_data_dir.join("static"),
        removed_dir.join("static"),
    )?;
    move_if_exists(
        context.program_data_dir.join("logs"),
        removed_dir.join("logs"),
    )?;

    Ok(())
}

fn verify_installed_version(install_dir: &Path, expected_version: &str) -> Result<(), String> {
    let executable_path = install_dir.join(server_service::SERVER_EXECUTABLE_NAME);
    verify_executable_version(
        &executable_path,
        expected_version,
        "La version installée de PServer",
    )
}

fn installed_server_version() -> Result<String, String> {
    let executable_path = server_service::server_executable_path()
        .ok_or_else(|| "PServer.exe n'est pas installé sur cette machine.".to_string())?;
    read_executable_version(&executable_path, "la version installée de PServer")
}

fn verify_executable_version(
    executable_path: &Path,
    expected_version: &str,
    version_source: &str,
) -> Result<(), String> {
    let actual = read_executable_version(executable_path, version_source)?;
    if normalize_version(&actual) == normalize_version(expected_version) {
        Ok(())
    } else {
        Err(format!(
            "{version_source} est {actual}, mais le manifest annonce {expected_version}."
        ))
    }
}

fn read_executable_version(executable_path: &Path, version_source: &str) -> Result<String, String> {
    let mut command = Command::new(executable_path);
    command.arg("version");
    hide_window(&mut command);

    let output = command.output().map_err(|error| {
        format!(
            "Impossible de vérifier {version_source} {}: {error}",
            executable_path.display()
        )
    })?;

    if !output.status.success() {
        return Err(format!(
            "Impossible de vérifier {version_source}. {}",
            server_service::command_output_text(&output)
        ));
    }

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        return Err(format!(
            "Impossible de vérifier {version_source}: réponse vide."
        ));
    }
    Ok(version)
}

fn normalize_version(value: &str) -> String {
    value.trim().trim_start_matches('v').to_string()
}

fn copy_if_exists(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }

    if source.is_dir() {
        copy_dir_all(source, target)
    } else {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Impossible de préparer la sauvegarde: {error}"))?;
        }
        fs::copy(source, target)
            .map(|_| ())
            .map_err(|error| format!("Impossible de sauvegarder {}: {error}", source.display()))
    }
}

fn copy_dir_all(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|error| format!("Impossible de créer {}: {error}", target.display()))?;

    for entry in fs::read_dir(source)
        .map_err(|error| format!("Impossible de lire {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("Impossible de lire une entrée: {error}"))?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());

        if source_path.is_dir() {
            copy_dir_all(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "Impossible de sauvegarder {}: {error}",
                    source_path.display()
                )
            })?;
        }
    }

    Ok(())
}

fn move_if_exists(source: PathBuf, target: PathBuf) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Impossible de préparer {}: {error}", parent.display()))?;
    }

    fs::rename(&source, &target).map_err(|error| {
        format!(
            "Impossible de déplacer {} vers {}: {error}",
            source.display(),
            target.display()
        )
    })
}

fn prepare_work_dir(version: &str) -> Result<PathBuf, String> {
    let root = env::temp_dir().join("psoft-server-update");
    let work_dir = root.join(sanitize_path_part(version));

    if work_dir.exists() {
        if !work_dir.starts_with(&root) {
            return Err("Dossier temporaire PServer invalide.".into());
        }
        fs::remove_dir_all(&work_dir).map_err(|error| {
            format!("Impossible de nettoyer le dossier temporaire PServer: {error}")
        })?;
    }

    fs::create_dir_all(&work_dir)
        .map_err(|error| format!("Impossible de créer le dossier temporaire PServer: {error}"))?;
    Ok(work_dir)
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
        Err("L’URL de mise à jour PServer doit utiliser HTTP ou HTTPS sans identifiants.".into())
    }
}

fn validate_sha256_format(value: &str) -> Result<(), String> {
    let clean = value.trim();
    if clean.len() == 64 && clean.chars().all(|character| character.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err("Le SHA-256 du package PServer est invalide.".into())
    }
}

fn read_config_value(path: &Path, section: &str, key: &str) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let mut in_section = false;

    for raw_line in content.lines() {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }

        if line.starts_with('[') && line.ends_with(']') {
            in_section = line.trim_matches(&['[', ']'][..]) == section;
            continue;
        }

        if !in_section {
            continue;
        }

        let Some((name, value)) = line.split_once('=') else {
            continue;
        };
        if name.trim() == key {
            return Some(unquote_toml_string(value.trim()));
        }
    }

    None
}

fn unquote_toml_string(value: &str) -> String {
    let unquoted = value
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .unwrap_or(value);

    unquoted.replace("\\\"", "\"").replace("\\\\", "\\")
}

fn read_json_string(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn parse_server_version(value: &str, source: &str) -> Result<Version, String> {
    Version::parse(value.trim().trim_start_matches('v'))
        .map_err(|_| format!("{source} contient une version invalide: {value}."))
}

fn sanitize_path_part(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
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
    use super::{
        configured_health_target, decode_stored_backup_key, file_sha256, is_update_backup_filename,
        remove_legacy_update_backups, remove_successful_update_backup, validate_pre_update_backup,
        validate_update_url, ServerUpdateBackup, ServerUpdateContext, BACKUP_KEY_ENVELOPE_MAGIC,
    };
    use reqwest::Url;
    use ring::aead;
    use std::fs;
    use std::io::Write;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_directory(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "psoft-update-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    fn test_context(root: &Path) -> ServerUpdateContext {
        let program_data_dir = root.join("program-data");
        let config_directory = program_data_dir.join("config");
        fs::create_dir_all(&config_directory).unwrap();
        fs::create_dir_all(program_data_dir.join("backups")).unwrap();
        ServerUpdateContext {
            install_dir: root.join("install"),
            program_data_dir,
            config_path: config_directory.join("server.toml"),
            config_directory,
            manifest_url: Url::parse("https://updates.example/pserver.json").unwrap(),
        }
    }

    fn write_encrypted_backup(path: &Path, key: &[u8]) {
        const MAGIC: &[u8] = b"PSOFT-BACKUP\0\x01";
        let key = aead::LessSafeKey::new(aead::UnboundKey::new(&aead::AES_256_GCM, key).unwrap());
        let prefix = [1_u8, 2, 3, 4, 5, 6, 7, 8];
        let mut file = fs::File::create(path).unwrap();
        file.write_all(MAGIC).unwrap();
        file.write_all(&prefix).unwrap();

        for (counter, plain) in [b"encrypted database".as_slice(), b"".as_slice()]
            .into_iter()
            .enumerate()
        {
            let counter_bytes = (counter as u32).to_be_bytes();
            let mut nonce = [0_u8; 12];
            nonce[..8].copy_from_slice(&prefix);
            nonce[8..].copy_from_slice(&counter_bytes);
            let mut associated_data = Vec::from(MAGIC);
            associated_data.extend_from_slice(&counter_bytes);
            let mut sealed = plain.to_vec();
            key.seal_in_place_append_tag(
                aead::Nonce::assume_unique_for_key(nonce),
                aead::Aad::from(associated_data),
                &mut sealed,
            )
            .unwrap();
            file.write_all(&(sealed.len() as u32).to_be_bytes())
                .unwrap();
            file.write_all(&sealed).unwrap();
        }
    }

    #[test]
    fn configured_health_target_uses_loopback_for_unspecified_bind() {
        let directory = std::env::temp_dir().join(format!(
            "psoft-update-health-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&directory).unwrap();
        let config_path = directory.join("server.toml");
        fs::write(&config_path, "[server]\nbind = \"0.0.0.0\"\nport = 8443\n").unwrap();

        let (origin, ca_path) = configured_health_target(&config_path, &directory).unwrap();

        assert_eq!(origin, "https://127.0.0.1:8443");
        assert_eq!(ca_path, directory.join("certificates").join("psoft-ca.crt"));
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn configured_health_target_rejects_invalid_endpoint() {
        let directory = std::env::temp_dir().join(format!(
            "psoft-update-health-invalid-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&directory).unwrap();
        let config_path = directory.join("server.toml");
        fs::write(
            &config_path,
            "[server]\nbind = \"not-an-address\"\nport = 0\n",
        )
        .unwrap();

        assert!(configured_health_target(&config_path, &directory).is_err());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn package_url_accepts_remote_http() {
        let url = validate_update_url("http://updates.example.com/pserver-setup.exe").unwrap();
        assert_eq!(url.scheme(), "http");
    }

    #[test]
    fn update_backup_requires_exported_matching_key_and_is_deleted_after_success() {
        let directory = test_directory("encrypted-backup");
        let context = test_context(&directory);
        let filename = "psoft-sqlite-20260802-120000.000000000Z.psoft-backup";
        let backup_path = context.program_data_dir.join("backups").join(filename);
        let encryption_key = [7_u8; 32];
        write_encrypted_backup(&backup_path, &encryption_key);
        let sha256 = file_sha256(&backup_path).unwrap();
        fs::write(
            backup_path.with_file_name(format!("{filename}.sha256")),
            format!("{sha256}\n"),
        )
        .unwrap();
        let backup = ServerUpdateBackup {
            filename: filename.into(),
            sha256,
            size: fs::metadata(&backup_path).unwrap().len(),
        };

        let error = validate_pre_update_backup(&context, &backup).unwrap_err();
        assert!(error.contains("Exportez la clé de récupération"));

        fs::write(context.config_directory.join("backup.key"), [8_u8; 32]).unwrap();
        fs::write(
            context.config_directory.join("backup.key.exported"),
            "2026-08-02T12:00:00Z",
        )
        .unwrap();
        let error = validate_pre_update_backup(&context, &backup).unwrap_err();
        assert!(error.contains("ne correspond pas à la clé exportée"));

        fs::write(context.config_directory.join("backup.key"), encryption_key).unwrap();
        assert_eq!(
            validate_pre_update_backup(&context, &backup).unwrap(),
            fs::canonicalize(&backup_path).unwrap()
        );

        #[cfg(windows)]
        {
            let protected =
                crate::dpapi::protect(&encryption_key, crate::dpapi::ProtectionScope::LocalMachine)
                    .unwrap();
            let mut envelope = BACKUP_KEY_ENVELOPE_MAGIC.to_vec();
            envelope.extend_from_slice(&protected);
            fs::write(context.config_directory.join("backup.key"), envelope).unwrap();
        }
        let validated_backup = validate_pre_update_backup(&context, &backup).unwrap();
        assert_eq!(validated_backup, fs::canonicalize(&backup_path).unwrap());
        remove_successful_update_backup(&validated_backup).unwrap();
        assert!(!backup_path.exists());
        assert!(!backup_path
            .with_file_name(format!("{filename}.sha256"))
            .exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn backup_key_decoder_accepts_only_supported_storage() {
        let legacy = [4_u8; 32];
        assert_eq!(decode_stored_backup_key(&legacy).unwrap(), legacy);
        assert!(decode_stored_backup_key(b"invalid").is_err());
        assert!(decode_stored_backup_key(BACKUP_KEY_ENVELOPE_MAGIC).is_err());
    }

    #[test]
    fn successful_update_removes_only_legacy_pre_update_directories() {
        assert!(is_update_backup_filename(
            "psoft-pre-update-sqlite-test.psoft-backup"
        ));
        assert!(!is_update_backup_filename("manual-copy.psoft-backup"));

        let directory = test_directory("legacy-backups");
        let update_backups = directory.join("update-backups");
        let legacy = update_backups.join("pre-update-123");
        let unrelated = update_backups.join("manual-recovery");
        fs::create_dir_all(&legacy).unwrap();
        fs::create_dir_all(&unrelated).unwrap();
        fs::write(legacy.join("db.sqlite3"), b"database").unwrap();
        fs::write(unrelated.join("keep.txt"), b"keep").unwrap();

        remove_legacy_update_backups(&directory).unwrap();

        assert!(!legacy.exists());
        assert!(unrelated.join("keep.txt").exists());
        fs::remove_dir_all(directory).unwrap();
    }
}
