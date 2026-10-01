use crate::{api_manager::APIManager, elevated_ipc, server_service};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Seek, SeekFrom, Write};
use std::path::Path;
use std::process::Command;
use std::thread;
use std::time::Duration;

const ELEVATED_PIPE_ARGUMENT: &str = "--pserver-remove-pipe";
const UNINSTALL_REGISTRY_KEY: &str =
    r"HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PServer";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuditRecord {
    timestamp: String,
    event: String,
    result: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    actor_id: Option<i64>,
    actor: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    device: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<BTreeMap<String, Value>>,
    #[serde(skip_serializing_if = "String::is_empty")]
    previous_hash: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    hash: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemovalRequest {
    pub api_base: String,
    pub token: String,
    pub device_id: Option<String>,
    pub expected_server_id: String,
}

#[derive(Deserialize, Serialize)]
struct RemovalResult {
    ok: bool,
    message: String,
}

pub fn remove(request: RemovalRequest) -> Result<String, String> {
    if !cfg!(target_os = "windows") {
        return Err(
            "La désinstallation locale de PServer est disponible uniquement sur Windows.".into(),
        );
    }
    server_service::verify_local_server_id(&request.expected_server_id)?;
    if server_service::is_elevated() {
        return consume_authorization(&request).and_then(|_| remove_elevated());
    }
    run_elevated(request)
}

pub(crate) fn handle_elevated_args() -> bool {
    let arguments = env::args().collect::<Vec<_>>();
    let Some(pipe_name) = arg_value(&arguments, ELEVATED_PIPE_ARGUMENT) else {
        return false;
    };

    let channel = elevated_ipc::Channel::connect(&pipe_name);
    let result = if !server_service::is_elevated() {
        Err("La désinstallation de PServer requiert une autorisation administrateur.".into())
    } else {
        channel
            .as_ref()
            .map_err(String::clone)
            .and_then(elevated_ipc::Channel::receive)
            .and_then(|raw| {
                serde_json::from_slice::<RemovalRequest>(&raw)
                    .map_err(|error| format!("Demande de désinstallation invalide: {error}"))
            })
            .and_then(|request| {
                server_service::verify_local_server_id(&request.expected_server_id)?;
                consume_authorization(&request)?;
                Ok(request)
            })
            .and_then(|_| remove_elevated())
    };
    let payload = match result {
        Ok(message) => RemovalResult { ok: true, message },
        Err(message) => RemovalResult { ok: false, message },
    };
    if let (Ok(channel), Ok(raw)) = (channel, serde_json::to_vec(&payload)) {
        let _ = channel.send(&raw);
    }
    std::process::exit(if payload.ok { 0 } else { 1 });
}

fn run_elevated(request: RemovalRequest) -> Result<String, String> {
    let executable =
        env::current_exe().map_err(|error| format!("Impossible de localiser PSoft: {error}"))?;
    let server = elevated_ipc::Server::create()?;
    let raw = serde_json::to_vec(&request)
        .map_err(|error| format!("Impossible de préparer la désinstallation: {error}"))?;
    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         try {{ \
             $process = Start-Process -WindowStyle Hidden -FilePath {executable} -ArgumentList @({argument}, {pipe}) -Verb RunAs -PassThru; \
         }} catch {{ exit 1223 }}; \
         if ($null -eq $process) {{ exit 1223 }}; \
         exit 0",
        executable = server_service::single_quote(&executable.to_string_lossy()),
        argument = server_service::single_quote(ELEVATED_PIPE_ARGUMENT),
        pipe = server_service::single_quote(server.name()),
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
    let status = command.status().map_err(|error| {
        format!("Impossible de demander l'autorisation administrateur: {error}")
    })?;
    if status.code() == Some(1223) {
        return Err("Désinstallation annulée: autorisation administrateur refusée.".into());
    }
    if !status.success() {
        return Err("Impossible de lancer la désinstallation PServer.".into());
    }

    let channel = server.accept()?;
    channel.send(&raw)?;
    let response = channel.receive()?;
    let result = serde_json::from_slice::<RemovalResult>(&response)
        .map_err(|error| format!("Réponse de désinstallation invalide: {error}"))?;
    if result.ok {
        Ok(result.message)
    } else {
        Err(result.message)
    }
}

fn consume_authorization(request: &RemovalRequest) -> Result<(), String> {
    tokio::runtime::Runtime::new()
        .map_err(|error| format!("Impossible de préparer la désinstallation: {error}"))?
        .block_on(APIManager::consume_local_uninstall(
            &request.api_base,
            &request.token,
            request.device_id.clone(),
        ))
}

fn remove_elevated() -> Result<String, String> {
    let install_dir = server_service::install_dir()?;
    validate_install_directory(&install_dir)?;
    if !install_dir.exists() && !server_service::service_exists()? {
        return Err("PServer n'est pas installé sur cette machine.".into());
    }

    let result: Result<String, String> = (|| {
        server_service::delete_service()
            .map_err(|error| format!("Impossible de supprimer le service PServer: {error}"))?;
        remove_system_registration()?;
        if install_dir.exists() {
            fs::remove_dir_all(&install_dir).map_err(|error| {
                format!("Impossible de supprimer les fichiers d'installation PServer: {error}")
            })?;
        }
        Ok("PServer a été désinstallé. Ses données ont été conservées.".to_string())
    })();

    match result {
        Ok(message) => {
            append_audit("success", None)?;
            Ok(message)
        }
        Err(error) => {
            let audit_error = append_audit("failure", Some(&error)).err();
            if let Some(audit_error) = audit_error {
                Err(format!(
                    "{error} Journalisation de l'échec impossible: {audit_error}"
                ))
            } else {
                Err(error)
            }
        }
    }
}

fn arg_value(arguments: &[String], name: &str) -> Option<String> {
    arguments
        .iter()
        .position(|argument| argument == name)
        .and_then(|index| arguments.get(index + 1))
        .cloned()
}

fn validate_install_directory(path: &Path) -> Result<(), String> {
    let expected = env::var_os("ProgramFiles")
        .map(std::path::PathBuf::from)
        .map(|root| root.join(server_service::INSTALL_DIRECTORY_NAME))
        .ok_or_else(|| "ProgramFiles est indisponible sur cette machine.".to_string())?;
    if path != expected
        || path.file_name().and_then(|name| name.to_str())
            != Some(server_service::INSTALL_DIRECTORY_NAME)
    {
        return Err("Dossier d'installation PServer invalide.".into());
    }
    if path
        .symlink_metadata()
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("Le dossier d'installation PServer ne peut pas être un lien.".into());
    }
    Ok(())
}

fn remove_system_registration() -> Result<(), String> {
    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         $key = {key}; \
         if (Test-Path -LiteralPath $key) {{ \
             $thumbprint = (Get-ItemProperty -LiteralPath $key -Name PServerCAThumbprint -ErrorAction SilentlyContinue).PServerCAThumbprint; \
             if ($thumbprint -match '^[0-9A-Fa-f]{{40,64}}$') {{ \
                 $certificate = Join-Path 'Cert:\\LocalMachine\\Root' $thumbprint; \
                 if (Test-Path -LiteralPath $certificate) {{ Remove-Item -LiteralPath $certificate -Force; }}; \
             }}; \
             Remove-Item -LiteralPath $key -Recurse -Force; \
         }}; \
         foreach ($rule in @('PSoft PServer HTTPS', 'PSoft PServer mDNS')) {{ \
             & netsh.exe advfirewall firewall delete rule name=$rule | Out-Null; \
             if ($LASTEXITCODE -ne 0) {{ throw \"Impossible de supprimer la règle pare-feu $rule.\"; }}; \
         }}",
        key = server_service::single_quote(UNINSTALL_REGISTRY_KEY),
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
    let output = command
        .output()
        .map_err(|error| format!("Impossible de nettoyer l'installation PServer: {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Impossible de nettoyer l'installation PServer: {}",
            server_service::command_output_text(&output)
        ))
    }
}

fn append_audit(result: &str, error: Option<&str>) -> Result<(), String> {
    let log_dir = server_service::program_data_dir()?.join("logs");
    fs::create_dir_all(&log_dir)
        .map_err(|error| format!("Impossible de préparer le journal de sécurité: {error}"))?;
    let path = log_dir.join("aosal");
    let mut file = open_audit_file(&path)?;
    let previous_hash = verify_audit_chain(&mut file)?;
    let mut metadata = BTreeMap::from([("preserveData".into(), Value::Bool(true))]);
    if let Some(error) = error {
        metadata.insert("error".into(), Value::String(error.to_string()));
    }
    if let Ok(username) = env::var("USERNAME") {
        metadata.insert("windowsUser".into(), Value::String(username));
    }
    let mut record = AuditRecord {
        timestamp: utc_timestamp(),
        event: "server.uninstall".into(),
        result: result.into(),
        actor_id: None,
        actor: "local-administrator".into(),
        ip: None,
        device: None,
        metadata: Some(metadata),
        previous_hash,
        hash: String::new(),
    };
    let unsigned = go_json(&record)
        .map_err(|error| format!("Impossible de signer le journal de sécurité: {error}"))?;
    record.hash = format!("{:x}", Sha256::digest(unsigned));
    let mut line = go_json(&record)
        .map_err(|error| format!("Impossible d'écrire le journal de sécurité: {error}"))?;
    line.push(b'\n');
    file.seek(SeekFrom::End(0))
        .and_then(|_| file.write_all(&line))
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Impossible d'écrire le journal de sécurité: {error}"))
}

fn open_audit_file(path: &Path) -> Result<File, String> {
    for _ in 0..20 {
        let mut options = OpenOptions::new();
        options.create(true).read(true).write(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0);
        }
        match options.open(path) {
            Ok(file) => return Ok(file),
            Err(_) => thread::sleep(Duration::from_millis(50)),
        }
    }
    Err("Impossible de verrouiller le journal de sécurité.".into())
}

fn verify_audit_chain(file: &mut File) -> Result<String, String> {
    file.seek(SeekFrom::Start(0))
        .map_err(|error| format!("Journal de sécurité illisible: {error}"))?;
    let mut previous = String::new();
    for line in BufReader::new(&mut *file).lines() {
        let line = line.map_err(|error| format!("Journal de sécurité illisible: {error}"))?;
        if line.trim().is_empty() {
            continue;
        }
        let mut record: AuditRecord = serde_json::from_str(&line)
            .map_err(|_| "La chaîne du journal de sécurité est invalide.".to_string())?;
        if record.previous_hash != previous || record.hash.len() != 64 {
            return Err("La chaîne du journal de sécurité est invalide.".into());
        }
        let expected = std::mem::take(&mut record.hash);
        let unsigned = go_json(&record)
            .map_err(|_| "La chaîne du journal de sécurité est invalide.".to_string())?;
        if format!("{:x}", Sha256::digest(unsigned)) != expected {
            return Err("La chaîne du journal de sécurité est invalide.".into());
        }
        previous = expected;
    }
    Ok(previous)
}

fn go_json(record: &AuditRecord) -> Result<Vec<u8>, serde_json::Error> {
    let encoded = serde_json::to_string(record)?;
    Ok(encoded
        .replace('&', "\\u0026")
        .replace('<', "\\u003c")
        .replace('>', "\\u003e")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029")
        .into_bytes())
}

#[cfg(windows)]
fn utc_timestamp() -> String {
    #[repr(C)]
    #[allow(non_snake_case)]
    struct SystemTime {
        wYear: u16,
        wMonth: u16,
        wDayOfWeek: u16,
        wDay: u16,
        wHour: u16,
        wMinute: u16,
        wSecond: u16,
        wMilliseconds: u16,
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GetSystemTime(system_time: *mut SystemTime);
    }
    let mut value = SystemTime {
        wYear: 0,
        wMonth: 0,
        wDayOfWeek: 0,
        wDay: 0,
        wHour: 0,
        wMinute: 0,
        wSecond: 0,
        wMilliseconds: 0,
    };
    unsafe { GetSystemTime(&mut value) };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        value.wYear,
        value.wMonth,
        value.wDay,
        value.wHour,
        value.wMinute,
        value.wSecond,
        value.wMilliseconds
    )
}

#[cfg(not(windows))]
fn utc_timestamp() -> String {
    String::new()
}

fn hide_window(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
}
