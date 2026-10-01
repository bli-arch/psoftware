use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

const MAX_SAVE_SIZE: usize = 1024 * 1024 * 1024;

pub fn save_file(
    owner: isize,
    filename: String,
    description: String,
    extension: String,
    data: Vec<u8>,
) -> Result<bool, String> {
    validate_request(&filename, &description, &extension, data.len())?;

    #[cfg(windows)]
    {
        let path = match windows_dialog(owner, &filename, &description, &extension)? {
            Some(path) => path,
            None => return Ok(false),
        };
        write_atomic(&path, &data)?;
        Ok(true)
    }

    #[cfg(not(windows))]
    {
        let _ = owner;
        Err("L'enregistrement natif est uniquement disponible sous Windows.".into())
    }
}

fn validate_request(
    filename: &str,
    description: &str,
    extension: &str,
    size: usize,
) -> Result<(), String> {
    if filename.is_empty()
        || filename.len() > 180
        || filename.contains(['/', '\\'])
        || filename.chars().any(char::is_control)
    {
        return Err("Nom de fichier invalide.".into());
    }
    if description.is_empty() || description.len() > 80 || description.chars().any(char::is_control)
    {
        return Err("Description de fichier invalide.".into());
    }
    if !extension.starts_with('.')
        || extension.len() > 32
        || !extension[1..]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        || !filename
            .to_ascii_lowercase()
            .ends_with(&extension.to_ascii_lowercase())
    {
        return Err("Extension de fichier invalide.".into());
    }
    if size > MAX_SAVE_SIZE {
        return Err("Le fichier dépasse la taille maximale autorisée.".into());
    }
    Ok(())
}

#[cfg(windows)]
fn windows_dialog(
    owner: isize,
    filename: &str,
    description: &str,
    extension: &str,
) -> Result<Option<PathBuf>, String> {
    use windows::core::{HRESULT, HSTRING, PCWSTR};
    use windows::Win32::Foundation::{ERROR_CANCELLED, HWND};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::HiDpi::{
        SetThreadDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
    };
    use windows::Win32::UI::Shell::Common::COMDLG_FILTERSPEC;
    use windows::Win32::UI::Shell::{
        FileSaveDialog, IFileSaveDialog, FOS_FORCEFILESYSTEM, FOS_NOCHANGEDIR, FOS_OVERWRITEPROMPT,
        SIGDN_FILESYSPATH,
    };

    unsafe {
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        initialized
            .ok()
            .map_err(|error| format!("Impossible d'initialiser le dialogue Windows : {error}"))?;
        struct ComGuard;
        impl Drop for ComGuard {
            fn drop(&mut self) {
                unsafe { CoUninitialize() };
            }
        }
        let _com = ComGuard;

        let previous_dpi = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        struct DpiGuard(windows::Win32::UI::HiDpi::DPI_AWARENESS_CONTEXT);
        impl Drop for DpiGuard {
            fn drop(&mut self) {
                if !self.0 .0.is_null() {
                    unsafe { SetThreadDpiAwarenessContext(self.0) };
                }
            }
        }
        let _dpi = DpiGuard(previous_dpi);

        let dialog: IFileSaveDialog = CoCreateInstance(&FileSaveDialog, None, CLSCTX_INPROC_SERVER)
            .map_err(|error| format!("Impossible d'ouvrir le dialogue Windows : {error}"))?;
        let title = HSTRING::from("Enregistrer sous");
        let ok_label = HSTRING::from("Enregistrer");
        let suggested_name = HSTRING::from(filename);
        let default_extension = HSTRING::from(extension.trim_start_matches('.'));
        let filter_name = HSTRING::from(description);
        let filter_pattern = HSTRING::from(format!("*{extension}"));
        let filter = [COMDLG_FILTERSPEC {
            pszName: PCWSTR(filter_name.as_ptr()),
            pszSpec: PCWSTR(filter_pattern.as_ptr()),
        }];

        dialog
            .SetOptions(FOS_FORCEFILESYSTEM | FOS_NOCHANGEDIR | FOS_OVERWRITEPROMPT)
            .and_then(|_| dialog.SetTitle(&title))
            .and_then(|_| dialog.SetOkButtonLabel(&ok_label))
            .and_then(|_| dialog.SetFileName(&suggested_name))
            .and_then(|_| dialog.SetDefaultExtension(&default_extension))
            .and_then(|_| dialog.SetFileTypes(&filter))
            .map_err(|error| format!("Impossible de configurer le dialogue Windows : {error}"))?;

        if let Err(error) = dialog.Show(Some(HWND(owner as *mut _))) {
            if error.code() == HRESULT::from_win32(ERROR_CANCELLED.0) {
                return Ok(None);
            }
            return Err(format!(
                "Impossible d'afficher le dialogue Windows : {error}"
            ));
        }

        let value = dialog
            .GetResult()
            .and_then(|item| item.GetDisplayName(SIGDN_FILESYSPATH))
            .map_err(|error| format!("Impossible de lire la destination : {error}"))?;
        let path = value
            .to_string()
            .map(PathBuf::from)
            .map_err(|error| format!("Destination invalide : {error}"));
        CoTaskMemFree(Some(value.0.cast()));
        path.map(Some)
    }
}

#[cfg(windows)]
fn write_atomic(destination: &Path, data: &[u8]) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use std::time::{SystemTime, UNIX_EPOCH};
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let parent = destination.parent().ok_or("Destination invalide.")?;
    let filename = destination
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("Nom de fichier invalide.")?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "Horloge système invalide.")?
        .as_nanos();
    let temporary = parent.join(format!(".{filename}.{}.{nonce}.tmp", std::process::id()));

    let result = (|| -> std::io::Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(data)?;
        file.sync_all()?;
        drop(file);

        let source: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
        let target: Vec<u16> = destination
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        if unsafe {
            MoveFileExW(
                source.as_ptr(),
                target.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        } == 0
        {
            return Err(std::io::Error::last_os_error());
        }
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result.map_err(|error| format!("Impossible d'enregistrer le fichier : {error}"))
}
