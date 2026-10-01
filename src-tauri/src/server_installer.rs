use crate::{
    certificates, dpapi, elevated_ipc, product_config, server_package, server_pairing,
    server_service,
};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::Write;
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const PSERVER_LICENSE_FILE_NAME: &str = "LICENSE.txt";
const PSERVER_LICENSE_MAX_BYTES: u64 = 1024 * 1024;
const POSTGRES_SSL_ROOT_CERTIFICATE_MAX_BYTES: usize = 1024 * 1024;
const BUNDLED_PSERVER_LICENSE: &str = include_str!("../resources/PServer-LICENSE.txt");

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInstallRequest {
    pub version: Option<String>,
    pub server_name: String,
    #[serde(default = "default_bind_address")]
    pub bind_address: String,
    pub public_url: String,
    pub database: DatabaseConfig,
    pub license_key: String,
    pub admin_username: String,
    pub admin_password: String,
    pub data_dir: Option<String>,
    pub expected_sha256: Option<String>,
    #[serde(default = "default_discovery_enabled")]
    pub discovery_enabled: bool,
    #[serde(default = "default_discovery_hostname")]
    pub discovery_hostname: String,
}

fn default_discovery_enabled() -> bool {
    true
}

fn default_bind_address() -> String {
    "0.0.0.0".into()
}

fn default_discovery_hostname() -> String {
    "pserver.local".into()
}

fn default_postgres_ssl_mode() -> String {
    "require".into()
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum DatabaseConfig {
    Sqlite {
        path: String,
    },
    Postgres {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: Option<String>,
        #[serde(default = "default_postgres_ssl_mode")]
        #[serde(rename = "sslMode")]
        ssl_mode: String,
        #[serde(rename = "sslRootCertificate")]
        ssl_root_certificate: Option<String>,
    },
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ElevatedInstallResult {
    ok: bool,
    message: String,
    api_base: Option<String>,
    ca_certificate: Option<String>,
}

struct InstalledServer {
    message: String,
    api_base: String,
    ca_certificate: String,
}

pub fn launch_server_installer(request: ServerInstallRequest) -> Result<String, String> {
    if !cfg!(target_os = "windows") {
        return Err("L'installation de PServer est disponible uniquement sur Windows.".into());
    }

    let installed = if !server_service::is_elevated() {
        run_elevated_installer(&request)?
    } else {
        install_server(request)?
    };
    server_pairing::trust_local(&installed.api_base, &installed.ca_certificate)?;
    Ok(installed.message)
}

pub fn handle_elevated_install_args() -> bool {
    let args: Vec<String> = env::args().collect();
    let Some(pipe_name) = arg_value(&args, "--pserver-install-pipe") else {
        return false;
    };

    let channel = elevated_ipc::Channel::connect(&pipe_name);
    let result = if server_service::is_elevated() {
        channel
            .as_ref()
            .map_err(String::clone)
            .and_then(elevated_ipc::Channel::receive)
    } else {
        Err("L'installation PServer requiert une autorisation administrateur.".into())
    }
    .and_then(|raw| {
        serde_json::from_slice::<ServerInstallRequest>(&raw)
            .map_err(|error| format!("Demande d'installation invalide: {error}"))
    })
    .and_then(install_server);

    let payload = match result {
        Ok(installed) => ElevatedInstallResult {
            ok: true,
            message: installed.message,
            api_base: Some(installed.api_base),
            ca_certificate: Some(installed.ca_certificate),
        },
        Err(message) => ElevatedInstallResult {
            ok: false,
            message,
            api_base: None,
            ca_certificate: None,
        },
    };

    if let (Ok(channel), Ok(raw)) = (channel, serde_json::to_vec(&payload)) {
        let _ = channel.send(&raw);
    }

    std::process::exit(if payload.ok { 0 } else { 1 });
}

fn install_server(request: ServerInstallRequest) -> Result<InstalledServer, String> {
    let install_dir = server_service::install_dir()?;
    let program_data_dir = server_service::program_data_dir()?;
    let config_path = server_service::config_path()?;
    let data_dir = server_data_directory(&request)?;
    let (server_toml, secrets) = build_server_configuration(&request)?;

    server_service::harden_server_directory(&program_data_dir)?;
    if let Some(parent) = config_path.parent() {
        server_service::harden_server_directory(parent)?;
    }
    server_service::harden_server_directory(&data_dir)?;
    if let DatabaseConfig::Sqlite { path } = &request.database {
        let database_path = Path::new(path.trim());
        let database_dir = database_path
            .parent()
            .ok_or_else(|| "Le dossier de la base SQLite est invalide.".to_string())?;
        if database_dir != data_dir {
            server_service::harden_server_directory(database_dir)?;
        }
    }

    let package_dir = server_package_directory();
    fs::create_dir_all(&package_dir)
        .map_err(|error| format!("Impossible de préparer le package PServer : {error}"))?;
    let package_path = package_dir.join("PServer-setup.exe");
    let target_exe = install_dir.join(server_service::SERVER_EXECUTABLE_NAME);
    let package_result = (|| {
        let package = server_package::latest_licensed(&request.license_key)?;
        server_package::download_verified(
            &package,
            request.expected_sha256.as_deref(),
            &package_path,
        )?;
        let extracted_exe = server_package::extract_executable(&package_path)?;
        let package_version = pserver_version(&extracted_exe)?;
        if normalize_version(&package.version) != normalize_version(&package_version) {
            return Err(format!(
                "Le manifest annonce PServer {}, mais le package contient la version {package_version}.",
                package.version
            ));
        }
        if request
            .version
            .as_deref()
            .map(str::trim)
            .filter(|version| !version.is_empty())
            .is_some_and(|version| {
                normalize_version(version) != normalize_version(&package_version)
            })
        {
            return Err(format!(
                "Le package PServer contient la version {package_version}, différente de la version attendue."
            ));
        }

        if server_service::service_exists()? {
            let _ = server_service::run_service_command("stop");
            server_service::wait_for_service_state("stopped", Duration::from_secs(20))?;
        }
        server_package::install(&package_path)?;

        let installed_version = pserver_version(&target_exe)?;
        if normalize_version(&installed_version) != normalize_version(&package_version) {
            return Err(format!(
                "PServer {package_version} a été vérifié, mais la version {installed_version} est installée."
            ));
        }
        Ok(installed_version)
    })();
    let _ = fs::remove_dir_all(&package_dir);
    let installed_version = package_result?;

    install_postgres_root_certificate(
        &request.database,
        config_path
            .parent()
            .ok_or_else(|| "Dossier de configuration PServer invalide.".to_string())?,
    )?;
    fs::write(&config_path, server_toml)
        .map_err(|error| format!("Impossible d'écrire server.toml: {error}"))?;
    protect_server_secrets(
        config_path
            .parent()
            .ok_or_else(|| "Dossier de configuration PServer invalide.".to_string())?
            .join("secrets"),
        &secrets,
    )?;
    product_config::install_bundled(
        config_path
            .parent()
            .ok_or_else(|| "Dossier de configuration PServer invalide.".to_string())?,
    )?;

    create_admin(&target_exe, &config_path, &request)?;
    configure_firewall(
        &target_exe,
        server_port(&request.public_url)?,
        &request.bind_address,
        request.discovery_enabled,
        &[],
    )?;
    server_service::install_or_update_service()?;
    server_service::run_service_command("start")?;
    server_service::wait_for_service_state("running", Duration::from_secs(45))?;

    let ca_path = ca_certificate_path()?;
    wait_for_file(&ca_path, Duration::from_secs(15))?;
    certificates::install_pserver_ca_file(&ca_path)?;
    wait_for_health(
        &health_origin(&request.bind_address, server_port(&request.public_url)?),
        &ca_path,
        Duration::from_secs(30),
    )?;
    let ca_certificate = fs::read_to_string(&ca_path)
        .map_err(|error| format!("Impossible de lire le certificat PServer : {error}"))?;

    Ok(InstalledServer {
        message: format!("PServer {installed_version} est installé et démarré."),
        api_base: format!("{}/api/v1", https_origin(&request.public_url)),
        ca_certificate,
    })
}

fn run_elevated_installer(request: &ServerInstallRequest) -> Result<InstalledServer, String> {
    let current_exe =
        env::current_exe().map_err(|error| format!("Impossible de localiser PSoft: {error}"))?;
    let server = elevated_ipc::Server::create()?;
    let raw = serde_json::to_vec(request)
        .map_err(|error| format!("Impossible de préparer l'installation: {error}"))?;

    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         try {{ \
             $process = Start-Process -WindowStyle Hidden -FilePath {exe} -ArgumentList @('--pserver-install-pipe', {pipe}) -Verb RunAs -PassThru; \
         }} catch {{ exit 1223 }}; \
         if ($null -eq $process) {{ exit 1223 }}; \
         exit 0",
        exe = server_service::single_quote(&current_exe.to_string_lossy()),
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
        return Err("Installation annulée: autorisation administrateur refusée.".into());
    }
    if !status.success() {
        return Err(format!(
            "Impossible de lancer l'installation PServer. Code de sortie: {}.",
            status.code().unwrap_or(-1)
        ));
    }

    let channel = server.accept()?;
    channel.send(&raw)?;
    let result = channel.receive()?;
    let result = serde_json::from_slice::<ElevatedInstallResult>(&result)
        .map_err(|error| format!("Réponse de l'installation invalide: {error}"))?;
    if result.ok {
        Ok(InstalledServer {
            message: result.message,
            api_base: result
                .api_base
                .ok_or_else(|| "Réponse d'installation sans adresse PServer.".to_string())?,
            ca_certificate: result
                .ca_certificate
                .ok_or_else(|| "Réponse d'installation sans certificat PServer.".to_string())?,
        })
    } else {
        Err(result.message)
    }
}

fn arg_value(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|arg| arg == name)
        .and_then(|index| args.get(index + 1))
        .cloned()
}

pub fn read_pserver_license() -> Result<String, String> {
    let path = server_service::install_dir()?.join(PSERVER_LICENSE_FILE_NAME);
    let metadata = match fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(BUNDLED_PSERVER_LICENSE.to_string());
        }
        Err(error) => {
            return Err(format!("Impossible de lire la licence PServer: {error}"));
        }
    };

    if !metadata.is_file() {
        return Err("Le fichier de licence PServer est invalide.".into());
    }
    if metadata.len() > PSERVER_LICENSE_MAX_BYTES {
        return Err("Le fichier de licence PServer est trop volumineux.".into());
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Impossible de lire la licence PServer: {error}"))?;
    if content.trim().is_empty() {
        return Err("Le fichier de licence PServer est vide.".into());
    }

    Ok(content)
}

fn pserver_version(executable: &Path) -> Result<String, String> {
    let mut command = Command::new(executable);
    command.arg("version");
    hide_window(&mut command);
    let output = command
        .output()
        .map_err(|error| format!("Impossible de lire la version de PServer: {error}"))?;
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if output.status.success() && !version.is_empty() {
        Ok(version)
    } else {
        Err("La version de PServer est invalide.".into())
    }
}

fn server_package_directory() -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    env::temp_dir().join(format!(
        "psoft-pserver-install-{}-{timestamp}",
        std::process::id()
    ))
}

fn normalize_version(version: &str) -> &str {
    version.trim().trim_start_matches('v')
}

pub fn verify_pserver_license(license_key: &str) -> Result<(), String> {
    let package = server_package::latest_licensed(license_key)?;
    server_package::ensure_available(&package)
}

fn ca_certificate_path() -> Result<PathBuf, String> {
    Ok(server_service::program_data_dir()?
        .join("config")
        .join("certificates")
        .join("psoft-ca.crt"))
}

fn wait_for_file(path: &Path, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if path.is_file() && path.metadata().map(|info| info.len() > 0).unwrap_or(false) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(250));
    }

    Err(format!(
        "Le certificat PServer n'a pas été généré ou il est vide: {}",
        path.display()
    ))
}

pub(crate) fn wait_for_health(
    public_url: &str,
    ca_path: &Path,
    timeout: Duration,
) -> Result<(), String> {
    let url = format!("{}/api/v1/system/health/", https_origin(public_url));
    let ca = fs::read(ca_path)
        .map_err(|error| format!("Impossible de lire le certificat PServer: {error}"))?;
    let certificate = reqwest::Certificate::from_pem(&ca)
        .map_err(|error| format!("Certificat PServer invalide: {error}"))?;
    let client = reqwest::blocking::Client::builder()
        .tls_built_in_root_certs(false)
        .add_root_certificate(certificate)
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|error| format!("Impossible de créer le client de vérification: {error}"))?;

    let deadline = Instant::now() + timeout;
    let mut last_error = String::new();

    while Instant::now() < deadline {
        match client.get(&url).send() {
            Ok(response) if response.status().is_success() => return Ok(()),
            Ok(response) => {
                last_error = format!("HTTP {}", response.status());
            }
            Err(error) => {
                last_error = error.to_string();
            }
        }
        thread::sleep(Duration::from_millis(500));
    }

    Err(format!(
        "PServer ne répond pas après démarrage ({url}). {last_error}"
    ))
}

fn create_admin(
    executable_path: &Path,
    config_path: &Path,
    request: &ServerInstallRequest,
) -> Result<(), String> {
    let username = request.admin_username.trim();
    let password = request.admin_password.as_str();
    if username.is_empty()
        || username.chars().count() > 150
        || username.chars().any(char::is_control)
        || password.chars().count() < 8
    {
        return Err(
            "L'identifiant est invalide ou le mot de passe contient moins de 8 caractères.".into(),
        );
    }

    #[derive(Serialize)]
    struct AdminCredentials<'a> {
        username: &'a str,
        password: &'a str,
    }

    let credentials = serde_json::to_vec(&AdminCredentials { username, password })
        .map_err(|error| format!("Impossible de préparer l'administrateur: {error}"))?;
    let config_arg = config_path.to_string_lossy().to_string();
    let mut command = Command::new(executable_path);
    command.args([
        "create-admin",
        "--config",
        &config_arg,
        "--credentials-stdin",
    ]);
    command.stdin(Stdio::piped());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    hide_window(&mut command);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Impossible de créer le premier administrateur: {error}"))?;
    child
        .stdin
        .take()
        .ok_or_else(|| "Impossible d'envoyer les identifiants administrateur.".to_string())?
        .write_all(&credentials)
        .map_err(|error| {
            format!("Impossible d'envoyer les identifiants administrateur: {error}")
        })?;
    let output = child.wait_with_output().map_err(|error| {
        format!("Impossible d'attendre la création de l'administrateur: {error}")
    })?;

    if output.status.success() {
        return Ok(());
    }

    Err(create_admin_failure(&server_service::command_output_text(
        &output,
    )))
}

fn create_admin_failure(detail: &str) -> String {
    if detail.contains("SQLSTATE 3D000") {
        return "La base de données PostgreSQL indiquée est introuvable (code:POSTGRES_DATABASE_NOT_FOUND).".into();
    }
    "Création de l'administrateur impossible (code:ADMIN_CREATION_FAILED).".into()
}

#[derive(Serialize)]
struct ServerSecrets {
    secret_key: String,
    database_password: Option<String>,
}

fn build_server_configuration(
    request: &ServerInstallRequest,
) -> Result<(String, ServerSecrets), String> {
    let server_name = request.server_name.trim();
    if server_name.is_empty()
        || server_name.chars().count() > 100
        || server_name.chars().any(char::is_control)
    {
        return Err("Le nom de PServer doit contenir entre 1 et 100 caractères.".into());
    }
    let bind_address = validate_bind_address(&request.bind_address)?;
    let discovery_hostname = validate_discovery_hostname(&request.discovery_hostname)?;
    let parsed_public_origin = reqwest::Url::parse(request.public_url.trim())
        .map_err(|error| format!("Adresse publique PServer invalide: {error}"))?;
    if parsed_public_origin.scheme() != "https"
        || !parsed_public_origin.username().is_empty()
        || parsed_public_origin.password().is_some()
        || !matches!(parsed_public_origin.path(), "" | "/")
        || parsed_public_origin.query().is_some()
        || parsed_public_origin.fragment().is_some()
    {
        return Err("L'adresse publique PServer doit être une origine HTTPS.".into());
    }
    let public_origin = parsed_public_origin.origin().ascii_serialization();
    let port = parsed_public_origin
        .port()
        .filter(|port| (1024..=49151).contains(port))
        .ok_or_else(|| "Le port PServer doit être compris entre 1024 et 49151.".to_string())?;
    let public_host = parsed_public_origin
        .host_str()
        .ok_or_else(|| "Adresse publique PServer invalide.".to_string())?;
    let secret_key = generate_secret_key()?;
    let data_dir = server_data_directory(request)?;

    let (database, database_password) = match &request.database {
        DatabaseConfig::Sqlite { path } => {
            let value = path.trim();
            let path = Path::new(value);
            if !path.is_absolute() || value.chars().any(char::is_control) {
                return Err("Le fichier SQLite doit utiliser un chemin absolu.".into());
            }
            (
                format!(
                    "engine = \"sqlite\"\nsqlite_path = \"{}\"\n",
                    escape_toml(&path.to_string_lossy())
                ),
                None,
            )
        }
        DatabaseConfig::Postgres {
            host,
            port,
            database,
            username,
            password,
            ssl_mode,
            ssl_root_certificate,
        } => {
            let host = host.trim();
            let database = database.trim();
            let username = username.trim();
            let ssl_mode = ssl_mode.trim().to_ascii_lowercase();
            if host.is_empty()
                || database.is_empty()
                || username.is_empty()
                || *port == 0
                || password.as_deref().map(str::trim).unwrap_or("").is_empty()
                || [host, database, username]
                    .iter()
                    .any(|value| value.chars().any(char::is_control))
            {
                return Err("La configuration PostgreSQL est incomplète.".into());
            }
            if !matches!(ssl_mode.as_str(), "disable" | "require" | "verify-full") {
                return Err("Le mode TLS PostgreSQL est invalide.".into());
            }
            let local_host = matches!(
                host.to_ascii_lowercase().as_str(),
                "localhost" | "127.0.0.1" | "::1"
            );
            if ssl_mode == "disable" && !local_host {
                return Err(
                    "TLS PostgreSQL ne peut être désactivé que pour une base locale.".into(),
                );
            }
            if ssl_mode == "verify-full" {
                let certificate = ssl_root_certificate
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| {
                        "Le certificat racine PostgreSQL est obligatoire.".to_string()
                    })?;
                validate_postgres_root_certificate(certificate)?;
            }
            let mut params_url = reqwest::Url::parse("postgres://localhost")
                .map_err(|error| format!("Paramètres PostgreSQL invalides: {error}"))?;
            {
                let mut params = params_url.query_pairs_mut();
                params.append_pair("sslmode", &ssl_mode);
                params.append_pair("connect_timeout", "10");
                if ssl_mode == "verify-full" {
                    params.append_pair(
                        "sslrootcert",
                        "C:\\ProgramData\\PServer\\config\\postgres-ca.crt",
                    );
                }
            }
            (
                format!(
                    "engine = \"postgres\"\nhost = \"{}\"\nport = {}\nname = \"{}\"\nuser = \"{}\"\nparams = \"{}\"\n",
                    escape_toml(host),
                    port,
                    escape_toml(database),
                    escape_toml(username),
                    escape_toml(params_url.query().unwrap_or_default()),
                ),
                password.clone(),
            )
        }
    };

    let mut allowed_hosts = vec![
        "localhost".to_string(),
        "127.0.0.1".to_string(),
        public_host.to_string(),
    ];
    if !matches!(bind_address.as_str(), "0.0.0.0" | "::")
        && !allowed_hosts
            .iter()
            .any(|host| host.eq_ignore_ascii_case(&bind_address))
    {
        allowed_hosts.push(bind_address.clone());
    }
    if request.discovery_enabled
        && !allowed_hosts
            .iter()
            .any(|host| host.eq_ignore_ascii_case(&discovery_hostname))
    {
        allowed_hosts.push(discovery_hostname.clone());
    }

    let config = format!(
        "[server]\nname = \"{}\"\nbind = \"{}\"\nport = {}\npublic_url = \"{}\"\nenvironment = \"production\"\ndiscovery = {}\ndiscovery_hostname = \"{}\"\n\n[security]\nallowed_hosts = [{}]\nvpn_networks = []\n\n[database]\n{}\n[paths]\ndata_dir = \"{}\"\nconfig_dir = \"C:\\\\ProgramData\\\\PServer\\\\config\"\nlog_dir = \"C:\\\\ProgramData\\\\PServer\\\\logs\"\nmedia_dir = \"{}\\\\media\"\nbackup_dir = \"C:\\\\ProgramData\\\\PServer\\\\backups\"\ntemp_dir = \"C:\\\\ProgramData\\\\PServer\\\\tmp\"\n\n[tls]\nauto = true\ncert_dir = \"C:\\\\ProgramData\\\\PServer\\\\config\\\\certificates\"\nca_file = \"C:\\\\ProgramData\\\\PServer\\\\config\\\\certificates\\\\psoft-ca.crt\"\nca_key = \"C:\\\\ProgramData\\\\PServer\\\\config\\\\certificates\\\\psoft-ca.key\"\ncert_file = \"C:\\\\ProgramData\\\\PServer\\\\config\\\\certificates\\\\pserver.crt\"\nkey_file = \"C:\\\\ProgramData\\\\PServer\\\\config\\\\certificates\\\\pserver.key\"\n\n[compatibility]\nschema_version = 1\n",
        escape_toml(server_name),
        escape_toml(&bind_address),
        port,
        escape_toml(&public_origin),
        request.discovery_enabled,
        escape_toml(&discovery_hostname),
        allowed_hosts
            .iter()
            .map(|host| format!("\"{}\"", escape_toml(host)))
            .collect::<Vec<_>>()
            .join(", "),
        database,
        escape_toml(&data_dir.to_string_lossy()),
        escape_toml(&data_dir.to_string_lossy())
    );
    Ok((
        config,
        ServerSecrets {
            secret_key,
            database_password,
        },
    ))
}

fn server_data_directory(request: &ServerInstallRequest) -> Result<PathBuf, String> {
    let value = request
        .data_dir
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("C:\\ProgramData\\PServer\\data");
    if value.chars().any(char::is_control) {
        return Err("Le dossier de données PServer doit utiliser un chemin absolu.".into());
    }
    let path = PathBuf::from(value);
    if !path.is_absolute() || path.parent().is_none() {
        return Err(
            "Le dossier de données PServer doit utiliser un chemin absolu non racine.".into(),
        );
    }
    Ok(path)
}

fn install_postgres_root_certificate(
    database: &DatabaseConfig,
    config_dir: &Path,
) -> Result<(), String> {
    let DatabaseConfig::Postgres {
        ssl_mode,
        ssl_root_certificate,
        ..
    } = database
    else {
        return Ok(());
    };
    if !ssl_mode.eq_ignore_ascii_case("verify-full") {
        return Ok(());
    }
    let certificate = ssl_root_certificate
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Le certificat racine PostgreSQL est obligatoire.".to_string())?;
    validate_postgres_root_certificate(certificate)?;
    fs::write(config_dir.join("postgres-ca.crt"), certificate.as_bytes())
        .map_err(|error| format!("Impossible d'installer le certificat PostgreSQL: {error}"))?;
    Ok(())
}

fn validate_postgres_root_certificate(certificate: &str) -> Result<(), String> {
    if certificate.len() > POSTGRES_SSL_ROOT_CERTIFICATE_MAX_BYTES {
        return Err("Le certificat PostgreSQL ne doit pas dépasser 1 Mo.".into());
    }
    reqwest::Certificate::from_pem(certificate.as_bytes())
        .map_err(|_| "Le certificat racine PostgreSQL est invalide.".to_string())?;
    Ok(())
}

fn https_origin(public_url: &str) -> String {
    let without_path = public_url.split_once("://").and_then(|(_, rest)| {
        rest.split('/')
            .next()
            .filter(|host| !host.trim().is_empty())
            .map(|host| format!("https://{host}"))
    });

    without_path.unwrap_or_else(|| "https://localhost:8000".into())
}

fn server_port(public_url: &str) -> Result<u16, String> {
    reqwest::Url::parse(public_url)
        .map_err(|error| format!("Adresse publique PServer invalide: {error}"))?
        .port()
        .filter(|port| (1024..=49151).contains(port))
        .ok_or_else(|| "Le port PServer doit être compris entre 1024 et 49151.".to_string())
}

fn validate_bind_address(value: &str) -> Result<String, String> {
    let address = value
        .trim()
        .trim_matches(['[', ']'])
        .parse::<IpAddr>()
        .map_err(|_| "L'adresse d'écoute PServer doit être une adresse IP.".to_string())?;
    if address.is_multicast() {
        return Err("L'adresse d'écoute PServer ne peut pas être multicast.".into());
    }
    Ok(address.to_string())
}

fn validate_discovery_hostname(value: &str) -> Result<String, String> {
    let hostname = value.trim().trim_end_matches('.').to_ascii_lowercase();
    let label = hostname.strip_suffix(".local").unwrap_or("");
    if label.is_empty()
        || label.len() > 63
        || label.contains('.')
        || label.starts_with('-')
        || label.ends_with('-')
        || !label
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err("Le nom mDNS doit contenir un nom valide terminé par .local.".into());
    }
    Ok(format!("{label}.local"))
}

fn health_origin(bind_address: &str, port: u16) -> String {
    let host = match bind_address.trim() {
        "0.0.0.0" => "127.0.0.1".to_string(),
        "::" => "[::1]".to_string(),
        address if address.contains(':') => format!("[{address}]"),
        address => address.to_string(),
    };
    format!("https://{host}:{port}")
}

fn configure_firewall(
    executable: &Path,
    port: u16,
    bind_address: &str,
    discovery_enabled: bool,
    vpn_networks: &[String],
) -> Result<(), String> {
    for name in ["PSoft PServer HTTPS", "PSoft PServer mDNS"] {
        let mut command = Command::new("netsh.exe");
        command.args([
            "advfirewall",
            "firewall",
            "delete",
            "rule",
            &format!("name={name}"),
        ]);
        hide_window(&mut command);
        let _ = command.status();
    }

    let bind_address = validate_bind_address(bind_address)?;
    let loopback_only = bind_address
        .parse::<IpAddr>()
        .map(|address| address.is_loopback())
        .unwrap_or(false);
    if !loopback_only {
        let remote_ips = std::iter::once("LocalSubnet")
            .chain(vpn_networks.iter().map(String::as_str))
            .collect::<Vec<_>>()
            .join(",");
        add_firewall_rule(
            "PSoft PServer HTTPS",
            executable,
            "TCP",
            &port.to_string(),
            &remote_ips,
        )?;
    }
    if discovery_enabled {
        add_firewall_rule(
            "PSoft PServer mDNS",
            executable,
            "UDP",
            "5353",
            "LocalSubnet",
        )?;
    }
    Ok(())
}

pub(crate) fn configure_existing_server_firewall(
    executable: &Path,
    config_path: &Path,
) -> Result<(), String> {
    let config = fs::read_to_string(config_path)
        .map_err(|error| format!("Impossible de lire la configuration PServer : {error}"))?;
    let server_section = config
        .split_once("[server]")
        .map(|(_, value)| value.split_once('\n').map_or(value, |(_, rest)| rest))
        .unwrap_or("")
        .split("\n[")
        .next()
        .unwrap_or("");
    let port = server_section
        .lines()
        .find_map(|line| line.trim().strip_prefix("port = "))
        .and_then(|value| value.trim().parse::<u16>().ok())
        .filter(|port| (1024..=49151).contains(port))
        .ok_or_else(|| "Port PServer invalide dans server.toml.".to_string())?;
    let bind_address = server_section
        .lines()
        .find_map(|line| line.trim().strip_prefix("bind = "))
        .map(|value| value.trim().trim_matches('"'))
        .unwrap_or("0.0.0.0");
    let discovery_enabled = server_section
        .lines()
        .find_map(|line| line.trim().strip_prefix("discovery = "))
        .map(|value| value.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(true);
    let security_section = config
        .split_once("[security]")
        .map(|(_, value)| value.split_once('\n').map_or(value, |(_, rest)| rest))
        .unwrap_or("")
        .split("\n[")
        .next()
        .unwrap_or("");
    let vpn_networks = security_section
        .lines()
        .find_map(|line| line.trim().strip_prefix("vpn_networks = "))
        .map(parse_vpn_networks)
        .transpose()?
        .unwrap_or_default();
    configure_firewall(
        executable,
        port,
        bind_address,
        discovery_enabled,
        &vpn_networks,
    )
}

fn parse_vpn_networks(value: &str) -> Result<Vec<String>, String> {
    let value = value.trim();
    let inner = value
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .ok_or_else(|| "Liste des réseaux VPN invalide dans server.toml.".to_string())?
        .trim();
    if inner.is_empty() {
        return Ok(Vec::new());
    }

    inner
        .split(',')
        .map(|value| {
            let cidr = value
                .trim()
                .strip_prefix('"')
                .and_then(|value| value.strip_suffix('"'))
                .ok_or_else(|| "Réseau VPN invalide dans server.toml.".to_string())?;
            validate_vpn_network(cidr)
        })
        .collect()
}

fn validate_vpn_network(value: &str) -> Result<String, String> {
    let (address, prefix) = value
        .split_once('/')
        .ok_or_else(|| format!("Réseau VPN invalide : {value}"))?;
    let address = address
        .parse::<IpAddr>()
        .map_err(|_| format!("Réseau VPN invalide : {value}"))?;
    let prefix = prefix
        .parse::<u8>()
        .map_err(|_| format!("Réseau VPN invalide : {value}"))?;

    let is_network = match address {
        IpAddr::V4(address) if (1..=32).contains(&prefix) => {
            let mask = u32::MAX.checked_shl(u32::from(32 - prefix)).unwrap_or(0);
            u32::from(address) & !mask == 0
        }
        IpAddr::V6(address) if (1..=128).contains(&prefix) => {
            let mask = u128::MAX.checked_shl(u32::from(128 - prefix)).unwrap_or(0);
            u128::from(address) & !mask == 0
        }
        _ => false,
    };
    if !is_network {
        return Err(format!("Réseau VPN trop large ou non canonique : {value}"));
    }
    Ok(format!("{address}/{prefix}"))
}

fn add_firewall_rule(
    name: &str,
    executable: &Path,
    protocol: &str,
    port: &str,
    remote_ips: &str,
) -> Result<(), String> {
    let mut command = Command::new("netsh.exe");
    command.args([
        "advfirewall",
        "firewall",
        "add",
        "rule",
        &format!("name={name}"),
        "dir=in",
        "action=allow",
        &format!("program={}", executable.display()),
        &format!("protocol={protocol}"),
        &format!("localport={port}"),
        &format!("remoteip={remote_ips}"),
        "profile=any",
        "enable=yes",
    ]);
    hide_window(&mut command);
    let output = command
        .output()
        .map_err(|error| format!("Impossible de configurer le pare-feu Windows : {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Impossible de configurer le pare-feu Windows. {}",
            server_service::command_output_text(&output)
        ))
    }
}

fn generate_secret_key() -> Result<String, String> {
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); -join ($bytes | ForEach-Object { $_.ToString('x2') })",
    ]);
    hide_window(&mut command);
    let output = command
        .output()
        .map_err(|error| format!("Impossible de générer la clé secrète PServer: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "Impossible de générer la clé secrète PServer. {}",
            server_service::command_output_text(&output)
        ));
    }

    let secret = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if secret.len() == 64
        && secret
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        Ok(secret)
    } else {
        Err("Clé secrète PServer générée invalide.".into())
    }
}

fn protect_server_secrets(path: PathBuf, secrets: &ServerSecrets) -> Result<(), String> {
    let raw = serde_json::to_vec(secrets)
        .map_err(|error| format!("Impossible de préparer les secrets PServer: {error}"))?;
    let protected = dpapi::protect(&raw, dpapi::ProtectionScope::LocalMachine)
        .map_err(|error| format!("Impossible de protéger les secrets PServer: {error}"))?;
    fs::write(path, protected)
        .map_err(|error| format!("Impossible d'écrire les secrets PServer: {error}"))
}

fn escape_toml(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
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
    use super::create_admin_failure;

    #[test]
    fn create_admin_failure_identifies_a_missing_postgres_database() {
        let detail = "2026/08/17 16:09:03 failed to connect: FATAL: database does not exist (SQLSTATE 3D000)";

        assert_eq!(
            create_admin_failure(detail),
            "La base de données PostgreSQL indiquée est introuvable (code:POSTGRES_DATABASE_NOT_FOUND)."
        );
    }

    #[test]
    fn create_admin_failure_hides_unexpected_command_details() {
        let detail = "2026/08/17 16:09:03 internal command detail at http://localhost";

        assert_eq!(
            create_admin_failure(detail),
            "Création de l'administrateur impossible (code:ADMIN_CREATION_FAILED)."
        );
    }
}
