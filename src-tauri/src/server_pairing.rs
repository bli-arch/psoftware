use crate::app_data;
use crate::dpapi::{self, ProtectionScope};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use hmac::{Hmac, Mac};
use reqwest::{Certificate, Client, Url};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const PAIRING_CODE_DIGITS: usize = 6;
const MAX_OFFER_BYTES: usize = 64 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairingOffer {
    id: String,
    salt: String,
    expires_at: i64,
    origin: String,
    server_name: String,
    certificate: String,
    fingerprint: String,
    authenticator: String,
}

#[derive(Serialize)]
struct PairingConfirmation<'a> {
    id: &'a str,
    proof: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct TrustRecord {
    origin: String,
    certificate: String,
    fingerprint: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingResult {
    server_id: String,
    server_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServerIdentity {
    ok: bool,
    server_id: String,
    server_name: String,
}

static CLIENTS: OnceLock<Mutex<HashMap<String, Client>>> = OnceLock::new();
static LOCAL_FINGERPRINTS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

pub async fn pair(api_base: &str, code: &str) -> Result<PairingResult, String> {
    let api_base = parse_api_base(api_base)?;
    if code.len() != PAIRING_CODE_DIGITS || !code.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(format!(
            "Le code d'association doit contenir {PAIRING_CODE_DIGITS} chiffres."
        ));
    }

    // This narrowly scoped client sends no credential and trusts nothing it receives
    // until the out-of-band pairing code authenticates the complete response.
    let bootstrap_client = client_builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|error| format!("Impossible de préparer l'association : {error}"))?;
    let mut response = bootstrap_client
        .get(endpoint_url(&api_base, "/system/pairing/"))
        .send()
        .await
        .map_err(|error| format!("Impossible de joindre PServer : {error}"))?;
    if !response.status().is_success() {
        return Err(if response.status().as_u16() == 404 {
            "Aucun code d'association actif. Demandez un nouveau code à l'administrateur.".into()
        } else {
            format!(
                "PServer a refusé l'association (HTTP {}).",
                response.status().as_u16()
            )
        });
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_OFFER_BYTES as u64)
    {
        return Err("La réponse d'association est trop volumineuse.".into());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Réponse d'association illisible : {error}"))?
    {
        if body.len() + chunk.len() > MAX_OFFER_BYTES {
            return Err("La réponse d'association est trop volumineuse.".into());
        }
        body.extend_from_slice(&chunk);
    }
    let offer: PairingOffer = serde_json::from_slice(&body)
        .map_err(|_| "La réponse d'association est invalide.".to_string())?;
    let key = validate_offer(&api_base, &offer, code)?;

    let certificate = Certificate::from_pem(offer.certificate.as_bytes())
        .map_err(|_| "Le certificat PServer est invalide.".to_string())?;
    let pinned_client = client_builder()
        .tls_built_in_root_certs(false)
        .add_root_certificate(certificate)
        .build()
        .map_err(|error| format!("Impossible de préparer la connexion sécurisée : {error}"))?;
    let identity = fetch_identity(&pinned_client, &api_base).await?;

    save_trust(
        &api_base,
        &TrustRecord {
            origin: origin(&api_base),
            certificate: offer.certificate.clone(),
            fingerprint: offer.fingerprint.clone(),
        },
    )?;
    client_cache()?
        .lock()
        .map_err(|_| "Le cache de certificats est indisponible.".to_string())?
        .insert(origin(&api_base), pinned_client.clone());

    let proof = hmac_hex(&key, &confirmation_transcript(&offer));
    let confirmation = pinned_client
        .post(endpoint_url(&api_base, "/system/pairing/confirm/"))
        .json(&PairingConfirmation {
            id: &offer.id,
            proof,
        })
        .send()
        .await
        .map_err(|error| {
            format!("Association enregistrée, mais confirmation impossible : {error}")
        })?;
    if !confirmation.status().is_success() {
        return Err("PServer a refusé la confirmation d'association.".into());
    }
    Ok(identity)
}

pub async fn identity(api_base: &str) -> Result<PairingResult, String> {
    let api_base = parse_api_base(api_base)?;
    let mut trusted_error = None;
    if let Some(client) = client_for(&api_base)? {
        match fetch_identity(&client, &api_base).await {
            Ok(identity) => return Ok(identity),
            Err(error) => trusted_error = Some(error),
        }
    }
    if trust_local_install(&api_base).await? {
        let client = client_for(&api_base)?
            .ok_or_else(|| "Le certificat PServer local n’a pas été enregistré.".to_string())?;
        return fetch_identity(&client, &api_base).await;
    }
    Err(trusted_error.unwrap_or_else(|| "Ce PServer n'est pas associé à PSoftware.".to_string()))
}

pub async fn is_trusted(api_base: &str) -> Result<bool, String> {
    let api_base = parse_api_base(api_base)?;
    if client_for(&api_base)?.is_some() {
        return Ok(true);
    }
    ensure_local_trust(&api_base).await
}

async fn fetch_identity(client: &Client, api_base: &Url) -> Result<PairingResult, String> {
    let response = client
        .get(endpoint_url(api_base, "/system/health/"))
        .send()
        .await
        .map_err(|_| "Le certificat ne correspond pas à l'adresse de ce PServer.".to_string())?;
    if !response.status().is_success() {
        return Err("PServer n'a pas confirmé son identité.".into());
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_OFFER_BYTES as u64)
    {
        return Err("La réponse d'identité PServer est trop volumineuse.".into());
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "La réponse d'identité PServer est illisible.".to_string())?;
    if bytes.len() > MAX_OFFER_BYTES {
        return Err("La réponse d'identité PServer est trop volumineuse.".into());
    }
    let identity: ServerIdentity = serde_json::from_slice(&bytes)
        .map_err(|_| "La réponse d'identité PServer est invalide.".to_string())?;
    if !identity.ok
        || !valid_server_id(&identity.server_id)
        || identity.server_name.trim().is_empty()
    {
        return Err("PServer n'a pas fourni une identité valide.".into());
    }
    Ok(PairingResult {
        server_id: identity.server_id,
        server_name: identity.server_name.trim().to_string(),
    })
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

pub fn trust_local(api_base: &str, certificate_pem: &str) -> Result<(), String> {
    let api_base = parse_api_base(api_base)?;
    let fingerprint = hex(&Sha256::digest(certificate_der(certificate_pem)?));
    let certificate = Certificate::from_pem(certificate_pem.as_bytes())
        .map_err(|_| "Le certificat PServer local est invalide.".to_string())?;
    let client = client_builder()
        .tls_built_in_root_certs(false)
        .add_root_certificate(certificate)
        .build()
        .map_err(|error| format!("Impossible de préparer la connexion PServer locale : {error}"))?;
    let record = TrustRecord {
        origin: origin(&api_base),
        certificate: certificate_pem.to_string(),
        fingerprint,
    };
    save_trust(&api_base, &record)?;
    client_cache()?
        .lock()
        .map_err(|_| "Le cache de certificats est indisponible.".to_string())?
        .insert(origin(&api_base), client);
    local_fingerprints()?
        .lock()
        .map_err(|_| "Le cache des certificats locaux est indisponible.".to_string())?
        .insert(origin(&api_base), record.fingerprint);
    Ok(())
}

pub async fn ensure_local_trust(api_base: &Url) -> Result<bool, String> {
    if client_for(api_base)?.is_some() {
        return Ok(true);
    }
    trust_local_install(api_base).await
}

async fn trust_local_install(api_base: &Url) -> Result<bool, String> {
    if crate::server_service::server_executable_path().is_none() {
        return Ok(false);
    }
    let local_server_id = match crate::server_service::local_server_id() {
        Ok(server_id) => server_id,
        Err(_) => return Ok(false),
    };
    let program_data_dir = match crate::server_service::program_data_dir() {
        Ok(directory) => directory,
        Err(_) => return Ok(false),
    };
    let certificate_path = program_data_dir
        .join("config")
        .join("certificates")
        .join("psoft-ca.crt");
    let certificate = match fs::read_to_string(certificate_path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(_) => return Ok(false),
    };
    let pinned_client = client_builder()
        .tls_built_in_root_certs(false)
        .add_root_certificate(
            Certificate::from_pem(certificate.as_bytes())
                .map_err(|_| "Le certificat PServer local est invalide.".to_string())?,
        )
        .build()
        .map_err(|error| format!("Impossible de préparer la connexion PServer locale : {error}"))?;
    let identity = match fetch_identity(&pinned_client, api_base).await {
        Ok(identity) => identity,
        Err(_) => return Ok(false),
    };
    if !identity.server_id.eq_ignore_ascii_case(&local_server_id) {
        return Ok(false);
    }

    trust_local(api_base.as_str(), &certificate)?;
    Ok(true)
}

pub fn client_for(api_base: &Url) -> Result<Option<Client>, String> {
    let key = origin(api_base);
    if let Some(client) = client_cache()?
        .lock()
        .map_err(|_| "Le cache de certificats est indisponible.".to_string())?
        .get(&key)
        .cloned()
    {
        return Ok(Some(client));
    }
    let Some(record) = load_trust(api_base)? else {
        return Ok(None);
    };
    let certificate = Certificate::from_pem(record.certificate.as_bytes())
        .map_err(|_| "Le certificat PServer enregistré est invalide.".to_string())?;
    let client = client_builder()
        .tls_built_in_root_certs(false)
        .add_root_certificate(certificate)
        .build()
        .map_err(|error| format!("Impossible de charger le certificat PServer : {error}"))?;
    client_cache()?
        .lock()
        .map_err(|_| "Le cache de certificats est indisponible.".to_string())?
        .insert(key, client.clone());
    Ok(Some(client))
}

fn validate_offer(api_base: &Url, offer: &PairingOffer, code: &str) -> Result<[u8; 32], String> {
    if offer.id.len() != 32 || !offer.id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("La réponse d'association est invalide.".into());
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "L'horloge système est invalide.".to_string())?
        .as_secs() as i64;
    if offer.expires_at <= now || offer.expires_at > now + 10 * 60 {
        return Err("Le code d'association a expiré.".into());
    }
    if offer.origin != origin(api_base) {
        return Err("Le code ne correspond pas à cette adresse PServer.".into());
    }
    let fingerprint = hex(&Sha256::digest(certificate_der(&offer.certificate)?));
    if fingerprint != offer.fingerprint {
        return Err("L'identité du certificat PServer est incohérente.".into());
    }
    let key = derive_key(code, &offer.salt)?;
    let authenticator = decode_hex(&offer.authenticator)?;
    HmacSha256::new_from_slice(&key)
        .map_err(|_| "La réponse d'association est invalide.".to_string())?
        .chain_update(pairing_transcript(offer))
        .verify_slice(&authenticator)
        .map_err(|_| "Le code d'association est incorrect.".to_string())?;
    Ok(key)
}

fn derive_key(code: &str, encoded_salt: &str) -> Result<[u8; 32], String> {
    let salt = BASE64
        .decode(encoded_salt)
        .map_err(|_| "La réponse d'association est invalide.".to_string())?;
    if salt.len() != 16 {
        return Err("La réponse d'association est invalide.".into());
    }
    let params = Params::new(64 * 1024, 3, 1, Some(32))
        .map_err(|_| "Paramètres d'association invalides.".to_string())?;
    let mut key = [0_u8; 32];
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(code.as_bytes(), &salt, &mut key)
        .map_err(|_| "Impossible de vérifier le code d'association.".to_string())?;
    Ok(key)
}

fn pairing_transcript(offer: &PairingOffer) -> String {
    format!(
        "psoft-pairing-v1\n{}\n{}\n{}\n{}\n{}",
        offer.id, offer.expires_at, offer.origin, offer.server_name, offer.fingerprint
    )
}

fn confirmation_transcript(offer: &PairingOffer) -> String {
    format!(
        "psoft-pairing-confirm-v1\n{}\n{}",
        offer.id, offer.fingerprint
    )
}

fn hmac_hex(key: &[u8], message: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(message.as_bytes());
    hex(&mac.finalize().into_bytes())
}

fn certificate_der(pem: &str) -> Result<Vec<u8>, String> {
    let mut lines = pem.lines();
    if lines.next() != Some("-----BEGIN CERTIFICATE-----") {
        return Err("Le certificat PServer est invalide.".into());
    }
    let mut encoded = String::new();
    let mut ended = false;
    for line in lines.by_ref() {
        if line == "-----END CERTIFICATE-----" {
            ended = true;
            break;
        }
        encoded.push_str(line.trim());
    }
    if !ended || lines.any(|line| !line.trim().is_empty()) {
        return Err("Le certificat PServer est invalide.".into());
    }
    BASE64
        .decode(encoded)
        .map_err(|_| "Le certificat PServer est invalide.".into())
}

fn parse_api_base(raw: &str) -> Result<Url, String> {
    let parsed = Url::parse(raw).map_err(|_| "L'adresse PServer est invalide.".to_string())?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("L'adresse PServer doit utiliser HTTPS.".into());
    }
    Ok(parsed)
}

fn endpoint_url(api_base: &Url, path: &str) -> Url {
    let mut url = api_base.clone();
    url.set_path(&format!(
        "{}{}",
        api_base.path().trim_end_matches('/'),
        path
    ));
    url.set_query(None);
    url.set_fragment(None);
    url
}

fn origin(url: &Url) -> String {
    url.origin().ascii_serialization()
}

fn client_builder() -> reqwest::ClientBuilder {
    Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
}

fn client_cache() -> Result<&'static Mutex<HashMap<String, Client>>, String> {
    Ok(CLIENTS.get_or_init(|| Mutex::new(HashMap::new())))
}

fn local_fingerprints() -> Result<&'static Mutex<HashMap<String, String>>, String> {
    Ok(LOCAL_FINGERPRINTS.get_or_init(|| Mutex::new(HashMap::new())))
}

fn trust_path(api_base: &Url) -> Result<PathBuf, String> {
    let directory = app_data::directory()?.join("trusted-servers");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Impossible de créer le dossier des certificats : {error}"))?;
    Ok(directory.join(format!(
        "{}.bin",
        hex(&Sha256::digest(origin(api_base).as_bytes()))
    )))
}

#[cfg(windows)]
fn save_trust(api_base: &Url, record: &TrustRecord) -> Result<(), String> {
    let raw = serde_json::to_vec(&record)
        .map_err(|_| "Impossible d'enregistrer le certificat PServer.".to_string())?;
    fs::write(
        trust_path(api_base)?,
        dpapi::protect(&raw, ProtectionScope::CurrentUser)?,
    )
    .map_err(|error| format!("Impossible d'enregistrer le certificat PServer : {error}"))
}

#[cfg(not(windows))]
fn save_trust(_api_base: &Url, _record: &TrustRecord) -> Result<(), String> {
    Err("L'association PServer est uniquement disponible sous Windows.".into())
}

#[cfg(windows)]
fn load_trust(api_base: &Url) -> Result<Option<TrustRecord>, String> {
    let protected = match fs::read(trust_path(api_base)?) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "Impossible de lire le certificat PServer : {error}"
            ))
        }
    };
    let record: TrustRecord = serde_json::from_slice(&dpapi::unprotect(&protected)?)
        .map_err(|_| "Le certificat PServer enregistré est corrompu.".to_string())?;
    if record.origin != origin(api_base) {
        return Err("Le certificat PServer enregistré appartient à une autre adresse.".into());
    }
    if hex(&Sha256::digest(certificate_der(&record.certificate)?)) != record.fingerprint {
        return Err("Le certificat PServer enregistré est corrompu.".into());
    }
    Ok(Some(record))
}

#[cfg(not(windows))]
fn load_trust(_api_base: &Url) -> Result<Option<TrustRecord>, String> {
    Ok(None)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    if value.len() % 2 != 0 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("La réponse d'association est invalide.".into());
    }
    (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16)
                .map_err(|_| "La réponse d'association est invalide.".to_string())
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_keeps_api_prefix() {
        let base = Url::parse("https://server.example:8443/api/v1").unwrap();
        assert_eq!(
            endpoint_url(&base, "/system/pairing/").as_str(),
            "https://server.example:8443/api/v1/system/pairing/"
        );
    }

    #[test]
    fn hex_decoder_rejects_invalid_values() {
        assert!(decode_hex("abc").is_err());
        assert!(decode_hex("zz").is_err());
    }
}
