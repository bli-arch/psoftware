use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager, Runtime};

const LEGACY_DIRECTORY_NAME: &str = "PSoft";
const WINDOW_STATE_FILE_NAME: &str = "window-state.json";
const TRUSTED_SERVERS_DIRECTORY_NAME: &str = "trusted-servers";

static DATA_DIRECTORY: OnceLock<PathBuf> = OnceLock::new();

pub fn initialize<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Unable to resolve local application data directory: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create local application data directory: {error}"))?;

    if let Some(existing) = DATA_DIRECTORY.get() {
        if existing != &directory {
            return Err("Local application data directory changed unexpectedly.".into());
        }
    } else {
        DATA_DIRECTORY
            .set(directory.clone())
            .map_err(|_| "Unable to initialize local application data directory.".to_string())?;
    }

    if let Some(legacy_directory) = dirs::config_dir().map(|path| path.join(LEGACY_DIRECTORY_NAME))
    {
        if legacy_directory != directory {
            if let Err(error) = migrate_legacy_data(&legacy_directory, &directory) {
                eprintln!("Unable to migrate legacy PSoftware data: {error}");
            }
        }
    }

    Ok(())
}

pub fn directory() -> Result<&'static Path, String> {
    DATA_DIRECTORY
        .get()
        .map(PathBuf::as_path)
        .ok_or_else(|| "Local application data directory is not initialized.".to_string())
}

fn migrate_legacy_data(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.is_dir() {
        return Ok(());
    }

    let mut errors = Vec::new();
    migrate_file(
        &source.join(WINDOW_STATE_FILE_NAME),
        &destination.join(WINDOW_STATE_FILE_NAME),
    )
    .unwrap_or_else(|error| errors.push(error));
    migrate_matching_files(source, destination, |name| {
        name.starts_with("cookies-") && (name.ends_with(".bin") || name.ends_with(".json"))
    })
    .unwrap_or_else(|error| errors.push(error));

    let legacy_trusted_servers = source.join(TRUSTED_SERVERS_DIRECTORY_NAME);
    migrate_matching_files(
        &legacy_trusted_servers,
        &destination.join(TRUSTED_SERVERS_DIRECTORY_NAME),
        |name| name.ends_with(".bin"),
    )
    .unwrap_or_else(|error| errors.push(error));

    let _ = fs::remove_dir(legacy_trusted_servers);
    let _ = fs::remove_dir(source);

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn migrate_matching_files(
    source: &Path,
    destination: &Path,
    matches: impl Fn(&str) -> bool,
) -> Result<(), String> {
    if !source.is_dir() {
        return Ok(());
    }

    let entries = fs::read_dir(source)
        .map_err(|error| format!("Unable to read {}: {error}", source.display()))?;
    let mut errors = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                errors.push(format!(
                    "Unable to read an entry in {}: {error}",
                    source.display()
                ));
                continue;
            }
        };
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                errors.push(format!(
                    "Unable to inspect {}: {error}",
                    entry.path().display()
                ));
                continue;
            }
        };
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if file_type.is_file() && matches(&name) {
            if let Err(error) = migrate_file(&entry.path(), &destination.join(name)) {
                errors.push(error);
            }
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn migrate_file(source: &Path, destination: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(source) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Unable to inspect {}: {error}", source.display())),
    };
    if !metadata.file_type().is_file() {
        return Ok(());
    }

    if destination.exists() {
        if destination.is_file()
            && fs::read(source)
                .ok()
                .zip(fs::read(destination).ok())
                .is_some_and(|(source_contents, destination_contents)| {
                    source_contents == destination_contents
                })
        {
            fs::remove_file(source)
                .map_err(|error| format!("Unable to remove {}: {error}", source.display()))?;
        }
        return Ok(());
    }

    let parent = destination
        .parent()
        .ok_or_else(|| format!("Invalid migration destination: {}", destination.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Unable to create {}: {error}", parent.display()))?;

    if fs::rename(source, destination).is_ok() {
        return Ok(());
    }

    let mut temporary_name = destination
        .file_name()
        .map(OsString::from)
        .ok_or_else(|| format!("Invalid migration destination: {}", destination.display()))?;
    temporary_name.push(".migration");
    let temporary = destination.with_file_name(temporary_name);
    let _ = fs::remove_file(&temporary);
    fs::copy(source, &temporary)
        .map_err(|error| format!("Unable to copy {}: {error}", source.display()))?;
    fs::rename(&temporary, destination).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        format!("Unable to finalize {}: {error}", destination.display())
    })?;
    fs::remove_file(source)
        .map_err(|error| format!("Unable to remove {}: {error}", source.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "psoftware-app-data-{name}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    #[test]
    fn migrates_only_known_legacy_data() {
        let root = test_directory("known");
        let source = root.join("roaming").join(LEGACY_DIRECTORY_NAME);
        let destination = root.join("local").join("com.psoft.app");
        fs::create_dir_all(source.join(TRUSTED_SERVERS_DIRECTORY_NAME)).unwrap();
        fs::write(source.join(WINDOW_STATE_FILE_NAME), "window").unwrap();
        fs::write(source.join("cookies-server.bin"), "session").unwrap();
        fs::write(
            source
                .join(TRUSTED_SERVERS_DIRECTORY_NAME)
                .join("server.bin"),
            "certificate",
        )
        .unwrap();
        fs::write(source.join("unrelated.txt"), "keep").unwrap();

        migrate_legacy_data(&source, &destination).unwrap();

        assert_eq!(
            fs::read_to_string(destination.join(WINDOW_STATE_FILE_NAME)).unwrap(),
            "window"
        );
        assert_eq!(
            fs::read_to_string(destination.join("cookies-server.bin")).unwrap(),
            "session"
        );
        assert_eq!(
            fs::read_to_string(
                destination
                    .join(TRUSTED_SERVERS_DIRECTORY_NAME)
                    .join("server.bin")
            )
            .unwrap(),
            "certificate"
        );
        assert_eq!(
            fs::read_to_string(source.join("unrelated.txt")).unwrap(),
            "keep"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn preserves_conflicting_legacy_data() {
        let root = test_directory("conflict");
        let source = root.join("roaming").join(LEGACY_DIRECTORY_NAME);
        let destination = root.join("local").join("com.psoft.app");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&destination).unwrap();
        fs::write(source.join(WINDOW_STATE_FILE_NAME), "legacy").unwrap();
        fs::write(destination.join(WINDOW_STATE_FILE_NAME), "current").unwrap();

        migrate_legacy_data(&source, &destination).unwrap();

        assert_eq!(
            fs::read_to_string(destination.join(WINDOW_STATE_FILE_NAME)).unwrap(),
            "current"
        );
        assert_eq!(
            fs::read_to_string(source.join(WINDOW_STATE_FILE_NAME)).unwrap(),
            "legacy"
        );

        fs::remove_dir_all(root).unwrap();
    }
}
