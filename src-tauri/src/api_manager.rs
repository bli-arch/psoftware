use crate::app_data;
use crate::dpapi::{self, ProtectionScope};
use crate::server_pairing;
use reqwest::header::{HeaderMap, HeaderValue, COOKIE};
use reqwest::{multipart, Client, Method, RequestBuilder, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

const API_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const API_REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const API_TRANSFER_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const COMPANY_LOGO_MAX_SOURCE_BYTES: usize = 4 * 1024 * 1024;
const SERVER_BACKUP_MAX_UPLOAD_BYTES: usize = 512 * 1024 * 1024;
const SERVER_BACKUP_RECOVERY_KEY_MAX_BYTES: usize = 4096;

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
struct Cookies {
    sessionid: String,
    csrftoken: String,
}

#[derive(Serialize)]
pub struct ApiResponse {
    pub(crate) status: u16,
    pub(crate) body: Option<Value>,
}

impl Cookies {
    fn new() -> Self {
        Cookies {
            sessionid: String::new(),
            csrftoken: String::new(),
        }
    }

    fn storage_path(api_base: &Url) -> Result<PathBuf, String> {
        let mut directory = app_data::directory()?.to_path_buf();
        fs::create_dir_all(&directory)
            .map_err(|error| format!("Unable to create cookie directory: {error}"))?;

        let origin = api_base.origin().ascii_serialization();
        let file_name = origin
            .chars()
            .map(|char| {
                if char.is_ascii_alphanumeric() {
                    char
                } else {
                    '_'
                }
            })
            .collect::<String>();

        directory.push(format!("cookies-{file_name}.bin"));
        Ok(directory)
    }

    #[cfg(windows)]
    fn from_file(api_base: &Url) -> Self {
        let Ok(path) = Self::storage_path(api_base) else {
            return Cookies::new();
        };

        if let Ok(protected) = fs::read(&path) {
            return dpapi::unprotect(&protected)
                .ok()
                .and_then(|raw| serde_json::from_slice(&raw).ok())
                .unwrap_or_else(Cookies::new);
        }

        let legacy_path = path.with_extension("json");
        let cookies = fs::read(&legacy_path)
            .ok()
            .and_then(|raw| serde_json::from_slice(&raw).ok())
            .unwrap_or_else(Cookies::new);
        if cookies != Cookies::new() {
            let _ = cookies.save_to_file(api_base);
        }
        let _ = fs::remove_file(legacy_path);
        cookies
    }

    #[cfg(not(windows))]
    fn from_file(api_base: &Url) -> Self {
        if let Ok(path) = Self::storage_path(api_base) {
            let _ = fs::remove_file(&path);
            let _ = fs::remove_file(path.with_extension("json"));
        }
        Cookies::new()
    }

    #[cfg(windows)]
    fn save_to_file(&self, api_base: &Url) -> Result<(), String> {
        let path = Self::storage_path(api_base)?;
        let legacy_path = path.with_extension("json");
        let _ = fs::remove_file(legacy_path);

        if *self == Cookies::new() {
            return match fs::remove_file(path) {
                Ok(()) => Ok(()),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(error) => Err(format!("Unable to remove session file: {error}")),
            };
        }

        let raw = serde_json::to_vec(self)
            .map_err(|error| format!("Unable to serialize cookies: {error}"))?;
        let protected = dpapi::protect(&raw, ProtectionScope::CurrentUser)
            .map_err(|error| format!("Unable to protect session cookies: {error}"))?;
        fs::write(path, protected)
            .map_err(|error| format!("Unable to save session cookies: {error}"))
    }

    #[cfg(not(windows))]
    fn save_to_file(&self, _api_base: &Url) -> Result<(), String> {
        Ok(())
    }
}

pub struct APIManager;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();
static COOKIE_CACHE: OnceLock<Mutex<HashMap<String, Cookies>>> = OnceLock::new();

impl APIManager {
    pub async fn authorize_local_uninstall(
        api_base: &str,
        device_id: Option<String>,
    ) -> Result<String, String> {
        require_loopback(api_base)?;
        let response = Self::request(
            "POST",
            api_base,
            "/admin/server/uninstall/authorize/",
            None,
            device_id,
        )
        .await?;
        if response.status != 201 {
            return Err("Cette action est réservée aux administrateurs PServer.".into());
        }
        response
            .body
            .as_ref()
            .and_then(|body| body.get("token"))
            .and_then(Value::as_str)
            .filter(|token| !token.is_empty())
            .map(str::to_owned)
            .ok_or_else(|| "Autorisation de désinstallation PServer invalide.".into())
    }

    pub async fn consume_local_uninstall(
        api_base: &str,
        token: &str,
        device_id: Option<String>,
    ) -> Result<(), String> {
        require_loopback(api_base)?;
        let response = Self::request(
            "POST",
            api_base,
            "/admin/server/uninstall/consume/",
            Some(serde_json::json!({ "token": token })),
            device_id,
        )
        .await?;
        if response.status == 204 {
            Ok(())
        } else {
            Err("L'autorisation de désinstallation PServer a expiré ou est invalide.".into())
        }
    }

    pub async fn request(
        method: &str,
        api_base: &str,
        path: &str,
        body: Option<Value>,
        device_id: Option<String>,
    ) -> Result<ApiResponse, String> {
        let method = parse_method(method)?;
        let (api_base, mut request) =
            authorized_request(method.clone(), api_base, path, device_id).await?;
        if matches!(
            path,
            "/admin/server/backups/pre-update/" | "/admin/server/backup/"
        ) {
            request = request.timeout(API_TRANSFER_TIMEOUT);
        }
        if !matches!(method, Method::GET | Method::DELETE) {
            request = request.json(&body.unwrap_or(Value::Object(Default::default())));
        }

        let response = request
            .send()
            .await
            .map_err(|error| format!("Error making API request: {error}"))?;

        update_cached_cookies(&api_base, &response)?;

        let status = response.status().as_u16();
        let text = response
            .text()
            .await
            .map_err(|error| format!("Error reading API response: {error}"))?;
        let body = if text.trim().is_empty() {
            None
        } else {
            Some(
                serde_json::from_str(&text)
                    .map_err(|error| format!("API response is not valid JSON: {error}"))?,
            )
        };

        Ok(ApiResponse { status, body })
    }

    pub async fn upload_backup(
        api_base: &str,
        filename: String,
        data: Vec<u8>,
        recovery_key: Option<String>,
        upload_token: String,
        device_id: Option<String>,
    ) -> Result<ApiResponse, String> {
        if data.is_empty() || data.len() > SERVER_BACKUP_MAX_UPLOAD_BYTES {
            return Err("Invalid backup upload size.".into());
        }
        if recovery_key
            .as_ref()
            .is_some_and(|value| value.len() > SERVER_BACKUP_RECOVERY_KEY_MAX_BYTES)
        {
            return Err("Invalid recovery key file size.".into());
        }

        let (api_base, request) = authorized_request(
            Method::POST,
            api_base,
            "/admin/server/backups/restore-upload/",
            device_id,
        )
        .await?;
        let backup = multipart::Part::bytes(data)
            .file_name(filename)
            .mime_str("application/octet-stream")
            .map_err(|error| format!("Invalid backup upload: {error}"))?;
        let mut form = multipart::Form::new()
            .part("backup", backup)
            .text("confirm", "true");
        if let Some(key) = recovery_key.filter(|value| !value.trim().is_empty()) {
            form = form.text("recoveryKey", key);
        }
        let response = request
            .header("X-PSoft-Restore-Token", upload_token)
            .timeout(API_TRANSFER_TIMEOUT)
            .multipart(form)
            .send()
            .await
            .map_err(|error| format!("Error uploading backup: {error}"))?;
        update_cached_cookies(&api_base, &response)?;
        json_api_response(response).await
    }

    pub async fn upload_company_logo(
        api_base: &str,
        png: Vec<u8>,
        svg: Option<String>,
        device_id: Option<String>,
    ) -> Result<ApiResponse, String> {
        if png.is_empty() || png.len() > COMPANY_LOGO_MAX_SOURCE_BYTES {
            return Err("Invalid company logo PNG.".into());
        }
        if svg
            .as_ref()
            .is_some_and(|value| value.len() > COMPANY_LOGO_MAX_SOURCE_BYTES)
        {
            return Err("Invalid company logo SVG.".into());
        }

        let (api_base, request) = authorized_request(
            Method::POST,
            api_base,
            "/settings/company-profile/logo",
            device_id,
        )
        .await?;
        let png_part = multipart::Part::bytes(png)
            .file_name("logo.png")
            .mime_str("image/png")
            .map_err(|error| format!("Invalid company logo upload: {error}"))?;
        let mut form = multipart::Form::new().part("png", png_part);
        if let Some(svg) = svg {
            let svg_part = multipart::Part::bytes(svg.into_bytes())
                .file_name("logo.svg")
                .mime_str("image/svg+xml")
                .map_err(|error| format!("Invalid company logo upload: {error}"))?;
            form = form.part("svg", svg_part);
        }

        let response = request
            .timeout(API_TRANSFER_TIMEOUT)
            .multipart(form)
            .send()
            .await
            .map_err(|error| format!("Error uploading company logo: {error}"))?;
        update_cached_cookies(&api_base, &response)?;
        json_api_response(response).await
    }

    pub async fn download_company_logo(
        api_base: &str,
        variant: &str,
        device_id: Option<String>,
    ) -> Result<Vec<u8>, String> {
        if !matches!(variant, "png" | "svg") {
            return Err("Invalid company logo variant.".into());
        }
        download_bytes(
            Method::GET,
            api_base,
            &format!("/settings/company-profile/logo?variant={variant}"),
            None,
            device_id,
        )
        .await
    }

    pub async fn download_database(
        api_base: &str,
        current_password: String,
        device_id: Option<String>,
    ) -> Result<Vec<u8>, String> {
        download_bytes(
            Method::POST,
            api_base,
            "/admin/server/database/export/download/",
            Some(serde_json::json!({ "current_password": current_password })),
            device_id,
        )
        .await
    }

    pub async fn download_client_data(
        api_base: &str,
        uid: String,
        device_id: Option<String>,
    ) -> Result<Vec<u8>, String> {
        let uid = uid.trim();
        if uid.is_empty() {
            return Err("Identifiant client invalide.".into());
        }
        download_bytes(
            Method::POST,
            api_base,
            "/core/clients/data-export/download/",
            Some(serde_json::json!({ "uid": uid })),
            device_id,
        )
        .await
    }

    pub async fn download_backup(
        api_base: &str,
        filename: &str,
        device_id: Option<String>,
    ) -> Result<Vec<u8>, String> {
        if filename.is_empty()
            || !filename.ends_with(".psoft-backup")
            || !filename
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
        {
            return Err("Invalid backup filename.".into());
        }
        download_bytes(
            Method::GET,
            api_base,
            &format!("/admin/server/backups/{filename}/download/"),
            None,
            device_id,
        )
        .await
    }

    pub async fn download_document(
        api_base: &str,
        document_id: u64,
        device_id: Option<String>,
    ) -> Result<Vec<u8>, String> {
        if document_id == 0 {
            return Err("Identifiant de document invalide.".into());
        }
        download_bytes(
            Method::GET,
            api_base,
            &format!("/core/documents/{document_id}/download/"),
            None,
            device_id,
        )
        .await
    }

    pub fn clear_cookies(api_base: &str) -> Result<(), String> {
        let api_base = parse_api_base(api_base)?;
        let cleared = Cookies::new();
        cookie_cache()?
            .lock()
            .map_err(|_| "Cookie cache is unavailable.".to_string())?
            .insert(cookie_cache_key(&api_base), cleared.clone());
        cleared.save_to_file(&api_base)
    }
}

async fn download_bytes(
    method: Method,
    api_base: &str,
    path: &str,
    body: Option<Value>,
    device_id: Option<String>,
) -> Result<Vec<u8>, String> {
    let (api_base, mut request) = authorized_request(method, api_base, path, device_id).await?;
    if let Some(body) = body {
        request = request.json(&body);
    }
    let response = request
        .timeout(API_TRANSFER_TIMEOUT)
        .send()
        .await
        .map_err(|error| format!("Error downloading file: {error}"))?;
    update_cached_cookies(&api_base, &response)?;
    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Error reading database export: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "HTTP {}: {}",
            status.as_u16(),
            String::from_utf8_lossy(&bytes)
        ));
    }
    Ok(bytes.to_vec())
}

fn require_loopback(api_base: &str) -> Result<(), String> {
    let parsed = parse_api_base(api_base)?;
    if matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "::1")) {
        Ok(())
    } else {
        Err("La désinstallation est réservée au PServer installé sur ce poste.".into())
    }
}

async fn authorized_request(
    method: Method,
    api_base: &str,
    path: &str,
    device_id: Option<String>,
) -> Result<(Url, RequestBuilder), String> {
    let api_base = parse_api_base(api_base)?;
    server_pairing::ensure_local_trust(&api_base).await?;
    let url = build_url(&api_base, path)?;
    let cookies = cached_cookies(&api_base)?;
    let mut headers = HeaderMap::new();
    let cookie_header = format!(
        "sessionid={}; csrftoken={}",
        cookies.sessionid, cookies.csrftoken
    );
    headers.insert(
        COOKIE,
        HeaderValue::from_str(&cookie_header)
            .map_err(|error| format!("Invalid cookie header: {error}"))?,
    );
    if !cookies.csrftoken.is_empty() {
        headers.insert(
            "X-CSRFToken",
            HeaderValue::from_str(&cookies.csrftoken)
                .map_err(|error| format!("Invalid CSRF token header: {error}"))?,
        );
    }
    if let Some(device_id) = device_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        headers.insert(
            "X-PSoft-Device-Id",
            HeaderValue::from_str(device_id)
                .map_err(|error| format!("Invalid device id header: {error}"))?,
        );
    }
    let client = server_pairing::client_for(&api_base)?.unwrap_or_else(|| http_client().clone());
    Ok((api_base, client.request(method, url).headers(headers)))
}

async fn json_api_response(response: reqwest::Response) -> Result<ApiResponse, String> {
    let status = response.status().as_u16();
    let text = response
        .text()
        .await
        .map_err(|error| format!("Error reading API response: {error}"))?;
    let body = if text.trim().is_empty() {
        None
    } else {
        Some(
            serde_json::from_str(&text)
                .map_err(|error| format!("API response is not valid JSON: {error}"))?,
        )
    };
    Ok(ApiResponse { status, body })
}

fn http_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .connect_timeout(API_CONNECT_TIMEOUT)
            .timeout(API_REQUEST_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("default HTTP client configuration is valid")
    })
}

fn cookie_cache() -> Result<&'static Mutex<HashMap<String, Cookies>>, String> {
    Ok(COOKIE_CACHE.get_or_init(|| Mutex::new(HashMap::new())))
}

fn cookie_cache_key(api_base: &Url) -> String {
    api_base.origin().ascii_serialization()
}

fn cached_cookies(api_base: &Url) -> Result<Cookies, String> {
    let key = cookie_cache_key(api_base);
    let mut cache = cookie_cache()?
        .lock()
        .map_err(|_| "Cookie cache is unavailable.".to_string())?;

    if let Some(cookies) = cache.get(&key) {
        return Ok(cookies.clone());
    }

    let cookies = Cookies::from_file(api_base);
    cache.insert(key, cookies.clone());
    Ok(cookies)
}

fn parse_method(method: &str) -> Result<Method, String> {
    match method.to_ascii_uppercase().as_str() {
        "GET" => Ok(Method::GET),
        "POST" => Ok(Method::POST),
        "PUT" => Ok(Method::PUT),
        "PATCH" => Ok(Method::PATCH),
        "DELETE" => Ok(Method::DELETE),
        _ => Err(format!("Unsupported HTTP method: {method}")),
    }
}

fn parse_api_base(api_base: &str) -> Result<Url, String> {
    let parsed = Url::parse(api_base).map_err(|error| format!("Invalid API base URL: {error}"))?;
    match parsed.scheme() {
        "https" => Ok(parsed),
        "http" => Err("PSoft desktop requires HTTPS for API connections.".into()),
        scheme => Err(format!("Unsupported API URL scheme: {scheme}")),
    }
}

fn build_url(api_base: &Url, path: &str) -> Result<Url, String> {
    if !path.starts_with('/') || path.starts_with("//") {
        return Err("API path must be a root-relative path.".to_string());
    }
    if path.contains('#') {
        return Err("API path must not contain a URL fragment.".to_string());
    }

    let mut url = api_base.clone();
    let base_path = api_base.path().trim_end_matches('/');
    let (path, query) = path.split_once('?').unwrap_or((path, ""));
    url.set_path(&format!("{base_path}{path}"));
    url.set_query((!query.is_empty()).then_some(query));
    url.set_fragment(None);
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn api_base() -> Url {
        Url::parse("https://localhost:8000/api/v1").expect("valid API base")
    }

    #[test]
    fn build_url_keeps_query_out_of_path() {
        let url = build_url(&api_base(), "/core/operations/?limit=15&offset=0")
            .expect("URL should be valid");

        assert_eq!(
            url.as_str(),
            "https://localhost:8000/api/v1/core/operations/?limit=15&offset=0"
        );
        assert_eq!(url.path(), "/api/v1/core/operations/");
        assert_eq!(url.query(), Some("limit=15&offset=0"));
    }

    #[test]
    fn build_url_supports_query_on_endpoint_without_trailing_slash() {
        let url = build_url(&api_base(), "/settings/logs?level=all&limit=800")
            .expect("URL should be valid");

        assert_eq!(
            url.as_str(),
            "https://localhost:8000/api/v1/settings/logs?level=all&limit=800"
        );
        assert_eq!(url.path(), "/api/v1/settings/logs");
        assert_eq!(url.query(), Some("level=all&limit=800"));
    }

    #[test]
    fn build_url_rejects_fragments() {
        let error = build_url(&api_base(), "/core/operations/#fragment")
            .expect_err("fragments should be rejected");

        assert_eq!(error, "API path must not contain a URL fragment.");
    }
}

fn update_cached_cookies(api_base: &Url, response: &reqwest::Response) -> Result<(), String> {
    let mut response_cookies = HashMap::new();
    for cookie in response.cookies() {
        response_cookies.insert(cookie.name().to_string(), cookie.value().to_string());
    }

    if response_cookies.is_empty() {
        return Ok(());
    }

    let key = cookie_cache_key(api_base);
    let mut cache = cookie_cache()?
        .lock()
        .map_err(|_| "Cookie cache is unavailable.".to_string())?;
    let current = cache
        .entry(key)
        .or_insert_with(|| Cookies::from_file(api_base));
    let updated = Cookies {
        sessionid: response_cookies
            .get("sessionid")
            .unwrap_or(&current.sessionid)
            .to_string(),
        csrftoken: response_cookies
            .get("csrftoken")
            .unwrap_or(&current.csrftoken)
            .to_string(),
    };

    if *current == updated {
        return Ok(());
    }

    updated.save_to_file(api_base)?;
    *current = updated;
    Ok(())
}
