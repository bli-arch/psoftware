use crate::server_service;
use serde::Serialize;
use std::path::Path;
use std::process::Command;

const UNINSTALL_REGISTRY_KEY: &str =
    r"HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PServer";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CertificateInstallResult {
    installed: bool,
    store: String,
    detail: String,
}

pub fn refresh_local_pserver_ca() -> Result<CertificateInstallResult, String> {
    if !cfg!(target_os = "windows") {
        return Err(
            "L'installation du certificat PServer est disponible uniquement sur Windows.".into(),
        );
    }

    let path = server_service::program_data_dir()?
        .join("config")
        .join("certificates")
        .join("psoft-ca.crt");
    if !path.is_file() {
        return Err("Le certificat du PServer local est introuvable.".into());
    }

    install_pserver_ca_file(&path)?;

    Ok(CertificateInstallResult {
        installed: true,
        store: "Cert:\\LocalMachine\\Root".into(),
        detail: "Certificat PServer installé pour tous les utilisateurs Windows.".into(),
    })
}

pub(crate) fn install_pserver_ca_file(path: &Path) -> Result<(), String> {
    if certificate_is_current(path)? {
        return Ok(());
    }
    if server_service::is_elevated() {
        import_ca_certificate(path)
    } else {
        import_ca_certificate_elevated(path)
    }
}

fn import_ca_certificate(path: &Path) -> Result<(), String> {
    let output = powershell_command(&certificate_install_script(path))
        .output()
        .map_err(|error| format!("Impossible d'installer le certificat PServer: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(server_service::command_output_text(&output))
}

fn import_ca_certificate_elevated(path: &Path) -> Result<(), String> {
    let script = certificate_install_script(path);
    let ps_command = format!(
        "$ErrorActionPreference = 'Stop'; try {{ $process = Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', {}) -Verb RunAs -Wait -PassThru }} catch {{ exit 1223 }}; if ($null -eq $process) {{ exit 1223 }}; exit $process.ExitCode",
        server_service::single_quote(&script),
    );

    let output = powershell_command(&ps_command).output().map_err(|error| {
        format!("Impossible de demander l'autorisation administrateur: {error}")
    })?;

    if output.status.success() {
        return Ok(());
    }
    if output.status.code() == Some(1223) {
        return Err("Accès refusé.".into());
    }

    Err(format!(
        "Installation du certificat PServer échouée. {}",
        server_service::command_output_text(&output)
    ))
}

fn certificate_is_current(path: &Path) -> Result<bool, String> {
    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         $certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2({path}); \
         $installed = Test-Path -LiteralPath (Join-Path 'Cert:\\LocalMachine\\Root' $certificate.Thumbprint); \
         $stale = @(Get-ChildItem 'Cert:\\LocalMachine\\Root' | Where-Object {{ $_.Subject -eq $certificate.Subject -and $_.Thumbprint -ne $certificate.Thumbprint }}).Count -gt 0; \
         $key = {key}; \
         $tracked = if (Test-Path -LiteralPath $key) {{ (Get-ItemProperty -LiteralPath $key -Name PServerCAThumbprint -ErrorAction SilentlyContinue).PServerCAThumbprint }}; \
         if ($installed -and !$stale -and $tracked -eq $certificate.Thumbprint) {{ exit 0 }}; exit 2",
        path = server_service::single_quote(&path.to_string_lossy()),
        key = server_service::single_quote(UNINSTALL_REGISTRY_KEY),
    );
    let output = powershell_command(&script)
        .output()
        .map_err(|error| format!("Impossible de vérifier le certificat PServer: {error}"))?;
    match output.status.code() {
        Some(0) => Ok(true),
        Some(2) => Ok(false),
        _ => Err(format!(
            "Impossible de vérifier le certificat PServer. {}",
            server_service::command_output_text(&output)
        )),
    }
}

fn certificate_install_script(path: &Path) -> String {
    format!(
        "$ErrorActionPreference = 'Stop'; \
         $certificatePath = {path}; \
         $certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($certificatePath); \
         $key = {key}; \
         certutil.exe -addstore -f Root $certificatePath | Out-Null; \
         if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}; \
         Get-ChildItem 'Cert:\\LocalMachine\\Root' | Where-Object {{ $_.Subject -eq $certificate.Subject -and $_.Thumbprint -ne $certificate.Thumbprint }} | Remove-Item -Force; \
         if (Test-Path -LiteralPath $key) {{ Set-ItemProperty -LiteralPath $key -Name PServerCAThumbprint -Value $certificate.Thumbprint }}",
        path = server_service::single_quote(&path.to_string_lossy()),
        key = server_service::single_quote(UNINSTALL_REGISTRY_KEY),
    )
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

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    command
}
