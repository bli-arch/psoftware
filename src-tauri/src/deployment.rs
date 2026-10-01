use reqwest::Url;
use serde::Deserialize;

const CONFIGURATION: &str = include_str!("../resources/release-config.json");

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeploymentConfiguration {
    server_base_url: String,
}

pub fn server_base_url() -> Result<Url, String> {
    let configuration: DeploymentConfiguration = serde_json::from_str(CONFIGURATION)
        .map_err(|error| format!("Configuration du serveur de distribution invalide : {error}"))?;
    let url = Url::parse(configuration.server_base_url.trim())
        .map_err(|_| "L’adresse du serveur de distribution est invalide.".to_string())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("L’adresse du serveur de distribution doit être une origine HTTP ou HTTPS sans identifiants.".into());
    }
    Ok(url)
}

pub fn server_url(path: &str) -> Result<Url, String> {
    server_base_url()?
        .join(path.trim_start_matches('/'))
        .map_err(|_| "L’adresse du serveur de distribution est invalide.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configured_server_base_url_is_valid() {
        assert!(server_base_url().is_ok());
    }

    #[test]
    fn server_url_preserves_the_configured_scheme_and_origin() {
        let base = server_base_url().unwrap();
        let url = server_url("psoftware/latest.json").unwrap();
        assert_eq!(url.scheme(), base.scheme());
        assert_eq!(url.host_str(), base.host_str());
        assert_eq!(url.port(), base.port());
        assert_eq!(url.path(), "/psoftware/latest.json");
    }
}
