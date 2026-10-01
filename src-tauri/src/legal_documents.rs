use serde::Deserialize;

const CONDITIONS: &str = include_str!("../../static/CONDITIONS.txt");
const LICENSE: &str = include_str!("../../static/LICENSE.txt");

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PSoftwareDocument {
    Conditions,
    License,
}

pub fn read(document: PSoftwareDocument) -> String {
    match document {
        PSoftwareDocument::Conditions => CONDITIONS,
        PSoftwareDocument::License => LICENSE,
    }
    .to_owned()
}
