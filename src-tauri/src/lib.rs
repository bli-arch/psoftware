// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use serde_json::json;
use sysinfo::{CpuExt, System, SystemExt};

#[tauri::command]
fn get_system_info() -> serde_json::Value {
    // Initialize and refresh system information
    let mut sys = System::new_all();
    sys.refresh_all();

    // Gather CPU info (using brand names)
    let cpus: Vec<String> = sys
        .cpus()
        .iter()
        .map(|cpu| cpu.brand().to_string())
        .collect();

    // Get OS details
    let os_name = sys.name().unwrap_or_else(|| "Unknown".into());
    let os_version = sys.os_version().unwrap_or_else(|| "Unknown".into());

    // Memory details (in kilobytes)
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();

    // GPU info is not available from sysinfo, so we use a placeholder.
    let gpu_info = "GPU info not available".to_string();

    // Return all info as a JSON object.
    json!({
        "os_name": os_name,
        "os_version": os_version,
        "total_memory": total_memory,
        "used_memory": used_memory,
        "cpus": cpus,
        "gpu": gpu_info,
    })
}

use tauri::command;
mod api_manager;
mod app_data;
mod certificates;
mod deployment;
mod dpapi;
mod elevated_ipc;
mod legal_documents;
mod native_print;
mod native_save;
mod printer_capabilities;
mod product_config;
mod server_discovery;
mod server_installer;
mod server_package;
mod server_pairing;
mod server_removal;
mod server_service;
mod server_update;
mod software_update;
mod webview_cache;
mod window_state;
use api_manager::APIManager;
use serde_json::Value;
use server_installer::{launch_server_installer as run_server_installer, ServerInstallRequest};
use server_update::{ServerUpdateCheckRequest, ServerUpdateInstallRequest};

#[command]
async fn api_request(
    method: String,
    api_base: String,
    path: String,
    body: Option<Value>,
    device_id: Option<String>,
) -> Result<String, String> {
    let response = APIManager::request(&method, &api_base, &path, body, device_id).await?;
    serde_json::to_string(&response)
        .map_err(|error| format!("Unable to serialize response: {error}"))
}

#[command]
fn clear_api_cookies(api_base: String) -> Result<(), String> {
    APIManager::clear_cookies(&api_base)
}

#[command]
async fn pair_pserver(
    api_base: String,
    code: String,
) -> Result<server_pairing::PairingResult, String> {
    server_pairing::pair(&api_base, &code).await
}

#[command]
async fn pserver_identity(api_base: String) -> Result<server_pairing::PairingResult, String> {
    server_pairing::identity(&api_base).await
}

#[command]
async fn is_pserver_trusted(api_base: String) -> Result<bool, String> {
    server_pairing::is_trusted(&api_base).await
}

#[command]
async fn discover_pservers() -> Result<Vec<server_discovery::DiscoveredServer>, String> {
    server_discovery::discover().await
}

#[command]
async fn upload_server_backup(request: tauri::ipc::Request<'_>) -> Result<String, String> {
    use base64::Engine;

    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned)
    };
    let api_base = header("x-psoft-api-base").ok_or("API PServer manquante.")?;
    let encoded_filename = header("x-psoft-filename").ok_or("Nom de sauvegarde manquant.")?;
    let filename = String::from_utf8(
        base64::engine::general_purpose::STANDARD
            .decode(encoded_filename)
            .map_err(|_| "Nom de sauvegarde invalide.")?,
    )
    .map_err(|_| "Nom de sauvegarde invalide.")?;
    let upload_token =
        header("x-psoft-upload-token").ok_or("Autorisation de restauration manquante.")?;
    let recovery_key = header("x-psoft-recovery-key");
    let device_id = header("x-psoft-device-id");
    let data = match request.body() {
        tauri::ipc::InvokeBody::Raw(data) => data.clone(),
        _ => return Err("Le fichier de sauvegarde est invalide.".into()),
    };
    drop(request);
    let response = APIManager::upload_backup(
        &api_base,
        filename,
        data,
        recovery_key,
        upload_token,
        device_id,
    )
    .await?;
    serde_json::to_string(&response)
        .map_err(|error| format!("Unable to serialize response: {error}"))
}

#[command]
async fn upload_company_logo(
    api_base: String,
    png: Vec<u8>,
    svg: Option<String>,
    device_id: Option<String>,
) -> Result<String, String> {
    let response = APIManager::upload_company_logo(&api_base, png, svg, device_id).await?;
    serde_json::to_string(&response)
        .map_err(|error| format!("Unable to serialize response: {error}"))
}

#[command]
async fn download_company_logo(
    api_base: String,
    variant: String,
    device_id: Option<String>,
) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(
        APIManager::download_company_logo(&api_base, &variant, device_id).await?,
    ))
}

#[command]
async fn download_server_database(
    api_base: String,
    current_password: String,
    device_id: Option<String>,
) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(
        APIManager::download_database(&api_base, current_password, device_id).await?,
    ))
}

#[command]
async fn download_client_data(
    api_base: String,
    uid: String,
    device_id: Option<String>,
) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(
        APIManager::download_client_data(&api_base, uid, device_id).await?,
    ))
}

#[command]
async fn download_server_backup(
    api_base: String,
    filename: String,
    device_id: Option<String>,
) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(
        APIManager::download_backup(&api_base, &filename, device_id).await?,
    ))
}

#[command]
async fn download_document(
    api_base: String,
    document_id: u64,
    device_id: Option<String>,
) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(
        APIManager::download_document(&api_base, document_id, device_id).await?,
    ))
}

#[command]
async fn save_file(
    window: tauri::WebviewWindow,
    request: tauri::ipc::Request<'_>,
) -> Result<bool, String> {
    use base64::Engine;

    let decode_header = |name: &str| -> Result<String, String> {
        let encoded = request
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| format!("En-tête {name} manquant."))?;
        String::from_utf8(
            base64::engine::general_purpose::STANDARD
                .decode(encoded)
                .map_err(|_| format!("En-tête {name} invalide."))?,
        )
        .map_err(|_| format!("En-tête {name} invalide."))
    };
    let filename = decode_header("x-psoft-filename")?;
    let description = decode_header("x-psoft-description")?;
    let extension = decode_header("x-psoft-extension")?;
    let data = match request.body() {
        tauri::ipc::InvokeBody::Raw(data) => data.clone(),
        _ => return Err("Contenu de fichier invalide.".into()),
    };
    drop(request);

    #[cfg(windows)]
    let owner = window
        .hwnd()
        .map_err(|error| format!("Fenêtre principale indisponible : {error}"))?
        .0 as isize;
    #[cfg(not(windows))]
    let owner = 0;

    tauri::async_runtime::spawn_blocking(move || {
        native_save::save_file(owner, filename, description, extension, data)
    })
    .await
    .map_err(|error| format!("Dialogue d'enregistrement indisponible : {error}"))?
}

#[command]
fn set_remember_window_bounds(remember: bool) -> Result<(), String> {
    window_state::set_remember_window_bounds(remember)
}

#[command]
async fn clear_webview_cache(window: tauri::WebviewWindow) -> Result<(), String> {
    webview_cache::clear(window).await
}

#[command]
fn launch_server_installer(request: ServerInstallRequest) -> Result<String, String> {
    run_server_installer(request)
}

#[command]
async fn verify_pserver_license(license_key: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        server_installer::verify_pserver_license(&license_key)
    })
    .await
    .map_err(|error| format!("Vérification de la licence interrompue : {error}"))?
}

#[command]
fn read_pserver_license() -> Result<String, String> {
    server_installer::read_pserver_license()
}

#[command]
fn read_psoftware_document(document: legal_documents::PSoftwareDocument) -> String {
    legal_documents::read(document)
}

#[command]
async fn refresh_local_pserver_ca_certificate(
    expected_server_id: String,
) -> Result<certificates::CertificateInstallResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        server_service::verify_local_server_id(&expected_server_id)?;
        certificates::refresh_local_pserver_ca()
    })
    .await
    .map_err(|error| format!("Impossible d'actualiser le certificat PServer: {error}"))?
}

#[command]
async fn pserver_service_status() -> Result<server_service::ServerServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(server_service::status)
        .await
        .map_err(|error| format!("Impossible de vérifier le service PServer: {error}"))?
}

#[command]
async fn pserver_service_start() -> Result<server_service::ServerServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(server_service::start)
        .await
        .map_err(|error| format!("Impossible de démarrer le service PServer: {error}"))?
}

#[command]
async fn pserver_service_stop() -> Result<server_service::ServerServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(server_service::stop)
        .await
        .map_err(|error| format!("Impossible d'arrêter le service PServer: {error}"))?
}

#[command]
async fn pserver_service_restart() -> Result<server_service::ServerServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(server_service::restart)
        .await
        .map_err(|error| format!("Impossible de redémarrer le service PServer: {error}"))?
}

#[command]
async fn remove_local_pserver(
    api_base: String,
    device_id: Option<String>,
    expected_server_id: String,
) -> Result<String, String> {
    let identity = expected_server_id.clone();
    tauri::async_runtime::spawn_blocking(move || server_service::verify_local_server_id(&identity))
        .await
        .map_err(|error| format!("Impossible de vérifier l'identité PServer: {error}"))??;
    let token = APIManager::authorize_local_uninstall(&api_base, device_id.clone()).await?;
    let request = server_removal::RemovalRequest {
        api_base,
        token,
        device_id,
        expected_server_id,
    };
    tauri::async_runtime::spawn_blocking(move || server_removal::remove(request))
        .await
        .map_err(|error| format!("Impossible de désinstaller PServer: {error}"))?
}

#[command]
async fn pserver_update_check(
    request: ServerUpdateCheckRequest,
) -> Result<server_update::ServerUpdateCheckResult, String> {
    server_update::check(request).await
}

#[command]
async fn pserver_update_install(
    request: ServerUpdateInstallRequest,
) -> Result<server_update::ServerUpdateInstallResult, String> {
    server_update::install(request).await
}

#[command]
async fn psoftware_update_check(
    app: tauri::AppHandle,
) -> Result<Option<software_update::SoftwareUpdate>, String> {
    software_update::check(app).await
}

#[command]
async fn psoftware_update_install(
    app: tauri::AppHandle,
) -> Result<Option<software_update::SoftwareUpdate>, String> {
    software_update::install(app).await
}

#[command]
async fn psoftware_update_prepare(
    app: tauri::AppHandle,
) -> Result<Option<software_update::SoftwareUpdate>, String> {
    software_update::prepare(app).await
}

#[command]
fn psoftware_update_pending(
    app: tauri::AppHandle,
) -> Result<Option<software_update::SoftwareUpdate>, String> {
    software_update::pending(&app)
}

#[command]
async fn psoftware_update_apply(
    app: tauri::AppHandle,
) -> Result<Option<software_update::SoftwareUpdate>, String> {
    software_update::apply_staged(app).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    product_config::remove_legacy_bundled_files();
    if server_installer::handle_elevated_install_args() {
        return;
    }
    if server_update::handle_elevated_update_args() {
        return;
    }
    if server_service::handle_elevated_service_args() {
        return;
    }
    if server_removal::handle_elevated_args() {
        return;
    }

    tauri::Builder::default()
        .manage(native_print::PrintState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app_data::initialize(app.handle()).map_err(std::io::Error::other)?;
            match software_update::pending(app.handle()) {
                Ok(Some(_)) => {
                    let app_handle = app.handle().clone();
                    tauri::async_runtime::spawn(async move {
                        match software_update::apply_staged(app_handle.clone()).await {
                            Ok(Some(_)) => {
                                if let Err(error) =
                                    window_state::create_main_window_from_handle(&app_handle)
                                {
                                    eprintln!(
                                        "Unable to open PSoftware after update attempt: {error}"
                                    );
                                }
                            }
                            Err(error) => {
                                eprintln!("Unable to apply prepared PSoftware update: {error}");
                                if let Err(error) =
                                    window_state::create_main_window_from_handle(&app_handle)
                                {
                                    eprintln!(
                                        "Unable to open PSoftware after update attempt: {error}"
                                    );
                                }
                            }
                            Ok(None) => {
                                if let Err(error) =
                                    window_state::create_main_window_from_handle(&app_handle)
                                {
                                    eprintln!("Unable to open PSoftware: {error}");
                                }
                            }
                        }
                    });
                }
                Ok(None) => window_state::create_main_window(app)?,
                Err(error) => {
                    eprintln!("Unable to read prepared PSoftware update: {error}");
                    window_state::create_main_window(app)?;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_info,
            api_request,
            clear_api_cookies,
            pair_pserver,
            pserver_identity,
            is_pserver_trusted,
            discover_pservers,
            upload_server_backup,
            upload_company_logo,
            download_company_logo,
            download_server_database,
            download_client_data,
            download_server_backup,
            download_document,
            save_file,
            native_print::list_printers,
            printer_capabilities::get_printer_capabilities,
            native_print::print_document,
            set_remember_window_bounds,
            clear_webview_cache,
            verify_pserver_license,
            read_pserver_license,
            read_psoftware_document,
            launch_server_installer,
            refresh_local_pserver_ca_certificate,
            pserver_service_status,
            pserver_service_start,
            pserver_service_stop,
            pserver_service_restart,
            remove_local_pserver,
            pserver_update_check,
            pserver_update_install,
            psoftware_update_check,
            psoftware_update_install,
            psoftware_update_prepare,
            psoftware_update_pending,
            psoftware_update_apply
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
