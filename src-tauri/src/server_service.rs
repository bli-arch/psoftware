use crate::server_installer;
use serde::Serialize;
use std::env;
use std::ffi::OsStr;
use std::fs;
use std::mem;
use std::os::raw::c_void;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};

pub(crate) const SERVICE_NAME: &str = "PSoftServer";
pub(crate) const SERVICE_DISPLAY_NAME: &str = "PServer";
pub(crate) const INSTALL_DIRECTORY_NAME: &str = "PServer";
pub(crate) const PROGRAM_DATA_DIRECTORY_NAME: &str = "PServer";
pub(crate) const SERVER_EXECUTABLE_NAME: &str = "PServer.exe";
const SERVICE_COMMAND_ARG: &str = "--psoft-service-command";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerServiceStatus {
    available: bool,
    elevated: bool,
    state: String,
    detail: String,
    executable_path: Option<String>,
    server_id: Option<String>,
    server_name: Option<String>,
}

pub fn status() -> Result<ServerServiceStatus, String> {
    service_status()
}

pub fn start() -> Result<ServerServiceStatus, String> {
    run_local_service_command("start")?;
    wait_for_service_state("running", Duration::from_secs(20))?;
    service_status()
}

pub fn stop() -> Result<ServerServiceStatus, String> {
    run_local_service_command("stop")?;
    wait_for_service_state("stopped", Duration::from_secs(20))?;
    service_status()
}

pub fn restart() -> Result<ServerServiceStatus, String> {
    run_local_service_command("restart")?;
    wait_for_service_state("running", Duration::from_secs(20))?;
    service_status()
}

pub(crate) fn handle_elevated_service_args() -> bool {
    let mut args = env::args().skip(1);

    while let Some(arg) = args.next() {
        if arg != SERVICE_COMMAND_ARG {
            continue;
        }

        let code = match args.next() {
            Some(command) => match run_service_command_elevated(&command) {
                Ok(()) => 0,
                Err(error) => {
                    eprintln!("{error}");
                    1
                }
            },
            _ => 1,
        };

        std::process::exit(code);
    }

    false
}

pub(crate) fn install_dir() -> Result<PathBuf, String> {
    env::var_os("ProgramFiles")
        .map(PathBuf::from)
        .map(|path| path.join(INSTALL_DIRECTORY_NAME))
        .ok_or_else(|| "ProgramFiles est indisponible sur cette machine.".into())
}

pub(crate) fn program_data_dir() -> Result<PathBuf, String> {
    env::var_os("ProgramData")
        .map(PathBuf::from)
        .map(|path| path.join(PROGRAM_DATA_DIRECTORY_NAME))
        .ok_or_else(|| "ProgramData est indisponible sur cette machine.".into())
}

pub(crate) fn server_executable_path() -> Option<PathBuf> {
    if !cfg!(target_os = "windows") {
        return None;
    }

    install_dir()
        .ok()
        .map(|path| path.join(SERVER_EXECUTABLE_NAME))
        .filter(|path| path.is_file())
}

pub(crate) fn default_server_executable_path() -> Result<PathBuf, String> {
    install_dir().map(|path| path.join(SERVER_EXECUTABLE_NAME))
}

pub(crate) fn config_path() -> Result<PathBuf, String> {
    program_data_dir().map(|path| path.join("config").join("server.toml"))
}

pub(crate) fn local_server_id() -> Result<String, String> {
    let executable = server_executable_path()
        .ok_or_else(|| "PServer.exe n'est pas installé sur cette machine.".to_string())?;
    let config = config_path()?;
    let output = Command::new(executable)
        .args(["identity", "--config"])
        .arg(config)
        .hidden_output()
        .map_err(|error| format!("Impossible de lire l'identité du PServer local: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Impossible de lire l'identité du PServer local. {}",
            command_output_text(&output)
        ));
    }
    let server_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if valid_server_id(&server_id) {
        Ok(server_id)
    } else {
        Err("Le PServer local n'a pas fourni une identité valide.".into())
    }
}

fn local_server_name() -> Option<String> {
    let name = serde_json::from_str::<String>(&server_config_value("name")?).ok()?;
    let name = name.trim();
    (!name.is_empty() && name.chars().count() <= 100 && !name.chars().any(char::is_control))
        .then(|| name.to_string())
}

fn server_config_value(expected_key: &str) -> Option<String> {
    let content = fs::read_to_string(config_path().ok()?).ok()?;
    let mut in_server_section = false;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.starts_with('[') && line.ends_with(']') {
            in_server_section = line == "[server]";
            continue;
        }
        if !in_server_section {
            continue;
        }

        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if key.trim() != expected_key {
            continue;
        }
        return Some(value.trim().to_string());
    }

    None
}

pub(crate) fn verify_local_server_id(expected: &str) -> Result<(), String> {
    if !valid_server_id(expected) {
        return Err("L'identité du PServer connecté est invalide.".into());
    }
    let local = local_server_id()?;
    if local.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err(
            "Action refusée: le PServer connecté n'est pas le PServer installé sur cet appareil."
                .into(),
        )
    }
}

pub(crate) fn harden_server_directory(path: &Path) -> Result<(), String> {
    if !path.is_absolute() || path.parent().is_none() {
        return Err("Le dossier PServer à protéger doit être un chemin absolu non racine.".into());
    }
    fs::create_dir_all(path)
        .map_err(|error| format!("Impossible de créer le dossier PServer: {error}"))?;

    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User; \
         $system = [Security.Principal.SecurityIdentifier]'S-1-5-18'; \
         $administrators = [Security.Principal.SecurityIdentifier]'S-1-5-32-544'; \
         $acl = New-Object Security.AccessControl.DirectorySecurity; \
         $acl.SetOwner($identity); \
         $acl.SetAccessRuleProtection($true, $false); \
         foreach ($sid in @($identity, $system, $administrators)) {{ \
             $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'); \
             $acl.AddAccessRule($rule); \
         }}; \
         Set-Acl -LiteralPath {path} -AclObject $acl",
        path = single_quote(&path.to_string_lossy()),
    );
    let output = powershell_command(&script)
        .hidden_output()
        .map_err(|error| format!("Impossible de protéger le dossier PServer: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(command_output_text(&output))
    }
}

pub(crate) fn install_or_update_service() -> Result<(), String> {
    let executable_path = default_server_executable_path()?;
    let config_path = config_path()?;
    let bin_path = format!(
        "\"{}\" --config \"{}\"",
        executable_path.display(),
        config_path.display()
    );

    install_or_update_service_elevated(&bin_path)?;
    run_sc(["description", SERVICE_NAME, "Provides background services required by PSoftware"])?;

    Ok(())
}

pub(crate) fn wait_for_service_state(expected: &str, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    let mut last_detail = "Aucun état de service disponible.".to_string();

    while Instant::now() < deadline {
        match service_status() {
            Ok(status) => {
                if status.state == expected {
                    return Ok(());
                }
                last_detail = status.detail;
            }
            Err(error) => last_detail = error,
        }
        thread::sleep(Duration::from_millis(200));
    }

    Err(format!(
        "PServer n'a pas atteint l'état {expected} dans le délai prévu. {last_detail}"
    ))
}

fn install_or_update_service_elevated(bin_path: &str) -> Result<(), String> {
    let service_key = format!("HKLM:\\SYSTEM\\CurrentControlSet\\Services\\{SERVICE_NAME}");
    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         $name = {name}; \
         $display = {display}; \
         $bin = {bin}; \
         $service = Get-Service -Name $name -ErrorAction SilentlyContinue; \
         if ($null -eq $service) {{ \
             New-Service -Name $name -DisplayName $display -BinaryPathName $bin -StartupType Automatic | Out-Null; \
         }} else {{ \
             Set-ItemProperty -Path {service_key} -Name ImagePath -Value $bin; \
             Set-ItemProperty -Path {service_key} -Name DisplayName -Value $display; \
             Set-Service -Name $name -StartupType Automatic; \
         }}",
        name = single_quote(SERVICE_NAME),
        display = single_quote(SERVICE_DISPLAY_NAME),
        bin = single_quote(bin_path),
        service_key = single_quote(&service_key),
    );

    let output = powershell_command(&script)
        .hidden_output()
        .map_err(|error| format!("Impossible de configurer le service PServer: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(command_output_text(&output))
}

pub(crate) fn service_exists() -> Result<bool, String> {
    let output = Command::new("sc.exe")
        .args(["query", SERVICE_NAME])
        .hidden_output()
        .map_err(|error| format!("Impossible de vérifier le service PServer: {error}"))?;

    if output.status.success() {
        return Ok(true);
    }

    let detail = command_output_text(&output);
    if detail.contains("1060") || detail.to_ascii_lowercase().contains("does not exist") {
        return Ok(false);
    }

    Err(detail)
}

pub(crate) fn delete_service() -> Result<(), String> {
    if !service_exists()? {
        return Ok(());
    }

    run_service_command_elevated("stop")?;
    wait_for_service_state("stopped", Duration::from_secs(20))?;
    match run_sc(["delete", SERVICE_NAME]) {
        Ok(()) => Ok(()),
        Err(error) if error.contains("1072") => Ok(()),
        Err(error) => Err(error),
    }
}

fn service_status() -> Result<ServerServiceStatus, String> {
    let elevated = is_elevated();
    let executable_path = server_executable_path();
    let server_id = executable_path
        .as_ref()
        .and_then(|_| local_server_id().ok());
    let server_name = executable_path.as_ref().and_then(|_| local_server_name());

    if executable_path.is_none() {
        return Ok(ServerServiceStatus {
            available: false,
            elevated,
            state: "not-installed".into(),
            detail: "PServer.exe n'est pas installé sur cette machine.".into(),
            executable_path: None,
            server_id: None,
            server_name: None,
        });
    }

    let output = Command::new("sc.exe")
        .args(["query", SERVICE_NAME])
        .hidden_output()
        .map_err(|error| format!("Impossible de vérifier l'état de PServer: {error}"))?;

    let detail = command_output_text(&output);
    if !output.status.success() {
        return Ok(ServerServiceStatus {
            available: false,
            elevated,
            state: "not-installed".into(),
            detail,
            executable_path: executable_path.map(|path| path.display().to_string()),
            server_id,
            server_name,
        });
    }

    Ok(ServerServiceStatus {
        available: true,
        elevated,
        state: normalize_service_state(&detail),
        detail,
        executable_path: executable_path.map(|path| path.display().to_string()),
        server_id,
        server_name,
    })
}

fn run_local_service_command(command: &str) -> Result<(), String> {
    if !service_exists()? {
        return Err("PServer n'est pas installé sur cette machine.".into());
    }
    if is_elevated() {
        run_service_command_elevated(command)
    } else {
        run_elevated_service_command(command)
    }
}

pub(crate) fn run_service_command(command: &str) -> Result<(), String> {
    if !service_exists()? {
        return Err("PServer n'est pas installé sur cette machine.".into());
    }

    if !is_elevated() {
        return Err("La commande interne PServer requiert une autorisation administrateur.".into());
    }

    run_service_command_elevated(command)
}

fn run_service_command_elevated(command: &str) -> Result<(), String> {
    match command {
        "start" => {
            server_installer::configure_existing_server_firewall(
                &default_server_executable_path()?,
                &config_path()?,
            )?;
            run_sc_service_command("start")
        }
        "stop" => run_sc_service_command("stop"),
        "restart" => {
            run_sc_service_command("stop")?;
            wait_for_service_state("stopped", Duration::from_secs(20))?;
            server_installer::configure_existing_server_firewall(
                &default_server_executable_path()?,
                &config_path()?,
            )?;
            run_sc_service_command("start")
        }
        _ => Err(format!("Commande PServer inconnue: {command}")),
    }
}

fn run_elevated_service_command(command: &str) -> Result<(), String> {
    if !matches!(command, "start" | "stop" | "restart") {
        return Err(format!("Commande PServer inconnue: {command}"));
    }

    let current_exe =
        env::current_exe().map_err(|error| format!("Impossible de localiser PSoft: {error}"))?;
    let parameters = format!("{SERVICE_COMMAND_ARG} {command}");
    let exit_code = run_elevated_process(&current_exe, &parameters)?;

    if exit_code == 0 {
        return Ok(());
    }

    Err(format!(
        "La commande PServer {command} a échoué. Code de sortie: {}.",
        exit_code
    ))
}

#[cfg(windows)]
pub(crate) fn run_elevated_process(
    executable: &std::path::Path,
    parameters: &str,
) -> Result<u32, String> {
    use std::os::windows::ffi::OsStrExt;

    const SEE_MASK_NOCLOSEPROCESS: u32 = 0x00000040;
    const SW_HIDE: i32 = 0;
    const INFINITE: u32 = 0xFFFF_FFFF;
    const ERROR_CANCELLED: u32 = 1223;

    #[repr(C)]
    struct ShellExecuteInfoW {
        cb_size: u32,
        f_mask: u32,
        hwnd: *mut c_void,
        lp_verb: *const u16,
        lp_file: *const u16,
        lp_parameters: *const u16,
        lp_directory: *const u16,
        n_show: i32,
        h_inst_app: *mut c_void,
        lp_id_list: *mut c_void,
        lp_class: *const u16,
        hkey_class: *mut c_void,
        dw_hot_key: u32,
        h_icon: *mut c_void,
        h_process: *mut c_void,
    }

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteExW(info: *mut ShellExecuteInfoW) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn WaitForSingleObject(handle: *mut c_void, milliseconds: u32) -> u32;
        fn GetExitCodeProcess(handle: *mut c_void, exit_code: *mut u32) -> i32;
        fn CloseHandle(handle: *mut c_void) -> i32;
        fn GetLastError() -> u32;
    }

    fn wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(Some(0)).collect()
    }

    let verb = wide(OsStr::new("runas"));
    let file = wide(executable.as_os_str());
    let params = wide(OsStr::new(parameters));
    let mut info = ShellExecuteInfoW {
        cb_size: mem::size_of::<ShellExecuteInfoW>() as u32,
        f_mask: SEE_MASK_NOCLOSEPROCESS,
        hwnd: std::ptr::null_mut(),
        lp_verb: verb.as_ptr(),
        lp_file: file.as_ptr(),
        lp_parameters: params.as_ptr(),
        lp_directory: std::ptr::null(),
        n_show: SW_HIDE,
        h_inst_app: std::ptr::null_mut(),
        lp_id_list: std::ptr::null_mut(),
        lp_class: std::ptr::null(),
        hkey_class: std::ptr::null_mut(),
        dw_hot_key: 0,
        h_icon: std::ptr::null_mut(),
        h_process: std::ptr::null_mut(),
    };

    let launched = unsafe { ShellExecuteExW(&mut info) };
    if launched == 0 {
        let error_code = unsafe { GetLastError() };
        if error_code == ERROR_CANCELLED {
            return Err("Accès refusé.".into());
        }

        return Err(format!(
            "Impossible de demander l'autorisation administrateur. Code Windows: {error_code}."
        ));
    }

    if info.h_process.is_null() {
        return Err("Impossible de suivre la commande administrateur.".into());
    }

    unsafe {
        WaitForSingleObject(info.h_process, INFINITE);
    }

    let mut exit_code = 1;
    let read_exit_code = unsafe { GetExitCodeProcess(info.h_process, &mut exit_code) };
    unsafe {
        CloseHandle(info.h_process);
    }

    if read_exit_code == 0 {
        return Err("Impossible de lire le résultat de la commande administrateur.".into());
    }

    Ok(exit_code)
}

#[cfg(not(windows))]
pub(crate) fn run_elevated_process(
    _executable: &std::path::Path,
    _parameters: &str,
) -> Result<u32, String> {
    Err("L'autorisation administrateur est disponible uniquement sur Windows.".into())
}

fn run_sc<const N: usize>(args: [&str; N]) -> Result<(), String> {
    let output = Command::new("sc.exe")
        .args(args)
        .hidden_output()
        .map_err(|error| format!("Impossible d'exécuter sc.exe: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(command_output_text(&output))
}

fn run_sc_service_command(command: &str) -> Result<(), String> {
    let output = Command::new("sc.exe")
        .args([command, SERVICE_NAME])
        .hidden_output()
        .map_err(|error| format!("Impossible d'exécuter sc.exe: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let detail = command_output_text(&output);
    if command == "start" && detail.contains("1056") {
        return Ok(());
    }
    if command == "stop" && detail.contains("1062") {
        return Ok(());
    }

    Err(detail)
}

fn powershell_command(script: &str) -> Command {
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ]);
    command
}

pub(crate) fn is_elevated() -> bool {
    if !cfg!(target_os = "windows") {
        return false;
    }

    Command::new("net")
        .arg("session")
        .hidden_output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

pub(crate) fn command_output_text(output: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    match (stdout.is_empty(), stderr.is_empty()) {
        (false, false) => format!("{stdout}\n{stderr}"),
        (false, true) => stdout,
        (true, false) => stderr,
        (true, true) => format!("Code de sortie: {}", output.status.code().unwrap_or(-1)),
    }
}

fn normalize_service_state(output: &str) -> String {
    let normalized = output.to_ascii_uppercase();

    if normalized.contains("RUNNING") {
        return "running".into();
    }
    if normalized.contains("STOPPED") {
        return "stopped".into();
    }
    if normalized.contains("START_PENDING") {
        return "starting".into();
    }
    if normalized.contains("STOP_PENDING") {
        return "stopping".into();
    }

    // Windows keeps these SCM state numbers stable when sc.exe localizes its text.
    for line in output.lines() {
        let Some((_, value)) = line.split_once(':') else {
            continue;
        };
        let state = value
            .split_whitespace()
            .next()
            .and_then(|value| value.parse::<u32>().ok());
        match state {
            Some(1) => return "stopped".into(),
            Some(2) => return "starting".into(),
            Some(3) => return "stopping".into(),
            Some(4) => return "running".into(),
            Some(5) => return "continuing".into(),
            Some(6) => return "pausing".into(),
            Some(7) => return "paused".into(),
            _ => {}
        }
    }

    "unknown".into()
}

fn valid_server_id(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| {
            if matches!(index, 8 | 13 | 18 | 23) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
}

pub(crate) fn single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

trait HiddenCommand {
    fn hidden_output(&mut self) -> std::io::Result<std::process::Output>;
}

impl HiddenCommand for Command {
    fn hidden_output(&mut self) -> std::io::Result<std::process::Output> {
        hide_window(self);
        self.output()
    }
}

fn hide_window(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
}
