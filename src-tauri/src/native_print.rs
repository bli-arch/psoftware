use serde::{Deserialize, Serialize};

pub(crate) const MIN_PAGE_SIZE_INCHES: f64 = 10.0 / 25.4;
const PRINT_OUTCOME_UNKNOWN_PREFIX: &str = "PRINT_OUTCOME_UNKNOWN:";

fn unknown_print_outcome(message: &str) -> String {
    format!("{PRINT_OUTCOME_UNKNOWN_PREFIX}{message}")
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterInfo {
    name: String,
    is_default: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintOptions {
    printer_name: String,
    copies: u16,
    color: PrintColor,
    orientation: PrintOrientation,
    duplex: bool,
    page_width: f64,
    page_height: f64,
    margins: PrintMargins,
    page_ranges: String,
}

#[derive(Debug, Deserialize)]
struct PrintMargins {
    top: f64,
    right: f64,
    bottom: f64,
    left: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum PrintColor {
    Color,
    Grayscale,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum PrintOrientation {
    Portrait,
    Landscape,
}

pub struct PrintState(pub tokio::sync::Mutex<()>);

impl Default for PrintState {
    fn default() -> Self {
        Self(tokio::sync::Mutex::new(()))
    }
}

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    platform::list_printers()
}

pub(crate) fn printer_is_installed(name: &str) -> Result<bool, String> {
    platform::list_printers().map(|printers| printers.iter().any(|printer| printer.name == name))
}

#[tauri::command]
pub async fn print_document(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, PrintState>,
    options: PrintOptions,
) -> Result<(), String> {
    let _guard = state.0.lock().await;
    validate_options(&options)?;
    platform::print_document(window, options).await
}

fn validate_options(options: &PrintOptions) -> Result<(), String> {
    if options.printer_name.encode_utf16().count() > 260 {
        return Err("Le nom de l’imprimante est invalide.".into());
    }
    if !(1..=999).contains(&options.copies) {
        return Err("Le nombre de copies doit être compris entre 1 et 999.".into());
    }
    if !options.page_width.is_finite()
        || !options.page_height.is_finite()
        || !(MIN_PAGE_SIZE_INCHES..=200.0).contains(&options.page_width)
        || !(MIN_PAGE_SIZE_INCHES..=200.0).contains(&options.page_height)
    {
        return Err("Le format de papier est invalide.".into());
    }
    let (page_width, page_height) = match options.orientation {
        PrintOrientation::Portrait => (options.page_width, options.page_height),
        PrintOrientation::Landscape => (options.page_height, options.page_width),
    };
    let margins = &options.margins;
    if [margins.top, margins.right, margins.bottom, margins.left]
        .into_iter()
        .any(|margin| !margin.is_finite() || margin < 0.0)
        || margins.left + margins.right >= page_width
        || margins.top + margins.bottom >= page_height
    {
        return Err("Les marges d’impression sont invalides.".into());
    }
    if !valid_page_ranges(&options.page_ranges) {
        return Err("La plage de pages est invalide.".into());
    }
    Ok(())
}

fn valid_page_ranges(value: &str) -> bool {
    if value.is_empty() {
        return true;
    }
    if value.len() > 100 {
        return false;
    }

    value.split(',').all(|part| {
        let mut bounds = part.trim().split('-');
        let start = bounds.next().and_then(|number| number.parse::<u32>().ok());
        let end_text = bounds.next();
        let end = end_text.and_then(|number| number.parse::<u32>().ok());
        bounds.next().is_none()
            && start.is_some_and(|number| number > 0)
            && end_text
                .is_none_or(|_| end.is_some_and(|number| number >= start.unwrap_or_default()))
    })
}

#[cfg(windows)]
mod platform {
    use std::mem::size_of;
    use std::slice;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use tauri::WebviewWindow;
    use tokio::sync::oneshot;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2PrintSettings2, ICoreWebView2_16,
        COREWEBVIEW2_PRINT_COLOR_MODE_COLOR, COREWEBVIEW2_PRINT_COLOR_MODE_GRAYSCALE,
        COREWEBVIEW2_PRINT_DUPLEX_ONE_SIDED, COREWEBVIEW2_PRINT_DUPLEX_TWO_SIDED_LONG_EDGE,
        COREWEBVIEW2_PRINT_MEDIA_SIZE_CUSTOM, COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE,
        COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT, COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE,
        COREWEBVIEW2_PRINT_STATUS_SUCCEEDED,
    };
    use webview2_com::PrintCompletedHandler;
    use windows::core::{Interface, HSTRING, PCWSTR, PWSTR};
    use windows::Win32::Graphics::Printing::{
        EnumPrintersW, GetDefaultPrinterW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
        PRINTER_INFO_4W,
    };

    use super::{unknown_print_outcome, PrintColor, PrintOptions, PrintOrientation, PrinterInfo};

    pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
        let default_printer = default_printer_name();
        let mut needed = 0;
        let mut returned = 0;
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;

        unsafe {
            let _ = EnumPrintersW(flags, PCWSTR::null(), 4, None, &mut needed, &mut returned);
        }
        if needed == 0 {
            return Ok(Vec::new());
        }

        let word_count = (needed as usize + size_of::<usize>() - 1) / size_of::<usize>();
        let mut storage = vec![0usize; word_count];
        let bytes = unsafe {
            slice::from_raw_parts_mut(
                storage.as_mut_ptr().cast::<u8>(),
                word_count * size_of::<usize>(),
            )
        };
        unsafe {
            EnumPrintersW(
                flags,
                PCWSTR::null(),
                4,
                Some(bytes),
                &mut needed,
                &mut returned,
            )
            .map_err(|error| format!("Impossible de lister les imprimantes : {error}"))?;
        }

        let entries = unsafe {
            slice::from_raw_parts(
                storage.as_ptr().cast::<PRINTER_INFO_4W>(),
                returned as usize,
            )
        };
        let mut printers = entries
            .iter()
            .filter_map(|entry| unsafe { entry.pPrinterName.to_string().ok() })
            .filter(|name| !name.trim().is_empty())
            .map(|name| PrinterInfo {
                is_default: default_printer.as_deref() == Some(name.as_str()),
                name,
            })
            .collect::<Vec<_>>();
        printers.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        printers.dedup_by(|left, right| left.name == right.name);
        Ok(printers)
    }

    pub async fn print_document(
        window: WebviewWindow,
        options: PrintOptions,
    ) -> Result<(), String> {
        let printers = list_printers()?;
        if options.printer_name.is_empty() {
            if !printers.iter().any(|printer| printer.is_default) {
                return Err("Aucune imprimante par défaut n’est configurée.".into());
            }
        } else if !printers
            .iter()
            .any(|printer| printer.name == options.printer_name)
        {
            return Err("L’imprimante sélectionnée n’est plus disponible.".into());
        }

        let (sender, receiver) = oneshot::channel::<Result<(), String>>();
        let sender = Arc::new(Mutex::new(Some(sender)));
        let callback_sender = Arc::clone(&sender);
        let schedule_sender = Arc::clone(&sender);

        let schedule_result = window.with_webview(move |platform_webview| {
            let result = (|| -> Result<(), String> {
                let environment: ICoreWebView2Environment6 = platform_webview
                    .environment()
                    .cast()
                    .map_err(|error| format!("Moteur d’impression indisponible : {error}"))?;
                let webview: ICoreWebView2_16 = unsafe {
                    platform_webview
                        .controller()
                        .CoreWebView2()
                        .and_then(|webview| webview.cast())
                }
                .map_err(|error| format!("Moteur d’impression indisponible : {error}"))?;
                let settings = unsafe { environment.CreatePrintSettings() }
                    .map_err(|error| format!("Options d’impression indisponibles : {error}"))?;
                let settings2: ICoreWebView2PrintSettings2 = settings
                    .cast()
                    .map_err(|error| format!("Options d’impression indisponibles : {error}"))?;

                unsafe {
                    settings2
                        .SetMediaSize(COREWEBVIEW2_PRINT_MEDIA_SIZE_CUSTOM)
                        .and_then(|_| {
                            settings.SetOrientation(match options.orientation {
                                PrintOrientation::Portrait => {
                                    COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT
                                }
                                PrintOrientation::Landscape => {
                                    COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE
                                }
                            })
                        })
                        .and_then(|_| settings.SetScaleFactor(1.0))
                        .and_then(|_| settings.SetPageWidth(options.page_width))
                        .and_then(|_| settings.SetPageHeight(options.page_height))
                        .and_then(|_| settings.SetMarginTop(options.margins.top))
                        .and_then(|_| settings.SetMarginBottom(options.margins.bottom))
                        .and_then(|_| settings.SetMarginLeft(options.margins.left))
                        .and_then(|_| settings.SetMarginRight(options.margins.right))
                        .and_then(|_| settings.SetShouldPrintBackgrounds(true))
                        .and_then(|_| settings.SetShouldPrintHeaderAndFooter(false))
                        .and_then(|_| settings2.SetCopies(i32::from(options.copies)))
                        .and_then(|_| {
                            settings2.SetColorMode(match options.color {
                                PrintColor::Color => COREWEBVIEW2_PRINT_COLOR_MODE_COLOR,
                                PrintColor::Grayscale => COREWEBVIEW2_PRINT_COLOR_MODE_GRAYSCALE,
                            })
                        })
                        .and_then(|_| {
                            settings2.SetDuplex(if options.duplex {
                                COREWEBVIEW2_PRINT_DUPLEX_TWO_SIDED_LONG_EDGE
                            } else {
                                COREWEBVIEW2_PRINT_DUPLEX_ONE_SIDED
                            })
                        })
                        .map_err(|error| format!("Options d’impression invalides : {error}"))?;

                    if !options.printer_name.is_empty() {
                        settings2
                            .SetPrinterName(&HSTRING::from(options.printer_name))
                            .map_err(|error| format!("Imprimante invalide : {error}"))?;
                    }
                    if !options.page_ranges.is_empty() {
                        settings2
                            .SetPageRanges(&HSTRING::from(options.page_ranges))
                            .map_err(|error| format!("Plage de pages invalide : {error}"))?;
                    }
                }

                let handler = PrintCompletedHandler::create(Box::new(move |error_code, status| {
                    let result = if status == COREWEBVIEW2_PRINT_STATUS_SUCCEEDED {
                        error_code.map_err(|error| {
                            format!(
                                "L’impression a échoué (code 0x{:08X}).",
                                error.code().0 as u32
                            )
                        })
                    } else if status == COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE {
                        Err("L’imprimante sélectionnée n’est pas disponible.".into())
                    } else {
                        Err(format!(
                            "L’impression a échoué (code 0x{:08X}).",
                            error_code.err().map_or(0, |error| error.code().0 as u32)
                        ))
                    };
                    if let Some(sender) =
                        callback_sender.lock().ok().and_then(|mut slot| slot.take())
                    {
                        let _ = sender.send(result);
                    }
                    Ok(())
                }));

                unsafe { webview.Print(&settings, &handler) }
                    .map_err(|error| format!("Impossible de démarrer l’impression : {error}"))
            })();

            if let Err(error) = result {
                if let Some(sender) = schedule_sender.lock().ok().and_then(|mut slot| slot.take()) {
                    let _ = sender.send(Err(error));
                }
            }
        });

        if let Err(error) = schedule_result {
            if let Some(sender) = sender.lock().ok().and_then(|mut slot| slot.take()) {
                let _ = sender.send(Err(format!("Fenêtre d’impression indisponible : {error}")));
            }
        }

        tokio::time::timeout(Duration::from_secs(120), receiver)
            .await
            .map_err(|_| {
                unknown_print_outcome(
                    "L’imprimante n’a pas confirmé le travail dans le délai imparti.",
                )
            })?
            .map_err(|_| {
                unknown_print_outcome("Le suivi du travail d’impression a été interrompu.")
            })?
    }

    fn default_printer_name() -> Option<String> {
        let mut length = 0;
        unsafe {
            let _ = GetDefaultPrinterW(None, &mut length);
        }
        if length == 0 {
            return None;
        }

        let mut buffer = vec![0u16; length as usize];
        if !unsafe { GetDefaultPrinterW(Some(PWSTR(buffer.as_mut_ptr())), &mut length) }.as_bool() {
            return None;
        }
        let end = buffer
            .iter()
            .position(|character| *character == 0)
            .unwrap_or(buffer.len());
        String::from_utf16(&buffer[..end]).ok()
    }
}

#[cfg(not(windows))]
mod platform {
    use tauri::WebviewWindow;

    use super::{PrintOptions, PrinterInfo};

    pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
        Err("L’impression directe n’est actuellement disponible que sous Windows.".into())
    }

    pub async fn print_document(
        _window: WebviewWindow,
        _options: PrintOptions,
    ) -> Result<(), String> {
        Err("L’impression directe n’est actuellement disponible que sous Windows.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        unknown_print_outcome, valid_page_ranges, validate_options, PrintColor, PrintMargins,
        PrintOptions, PrintOrientation, MIN_PAGE_SIZE_INCHES, PRINT_OUTCOME_UNKNOWN_PREFIX,
    };

    #[test]
    fn validates_page_ranges() {
        assert!(valid_page_ranges(""));
        assert!(valid_page_ranges("1"));
        assert!(valid_page_ranges("1-3, 5, 8-10"));
        assert!(!valid_page_ranges("0"));
        assert!(!valid_page_ranges("3-1"));
        assert!(!valid_page_ranges("1-2-3"));
        assert!(!valid_page_ranges("1-"));
        assert!(!valid_page_ranges("1,,2"));
    }

    #[test]
    fn accepts_sticker_page_sizes() {
        let mut options = PrintOptions {
            printer_name: String::new(),
            copies: 1,
            color: PrintColor::Grayscale,
            orientation: PrintOrientation::Portrait,
            duplex: false,
            page_width: 15.0 / 25.4,
            page_height: 30.0 / 25.4,
            margins: PrintMargins {
                top: 0.0,
                right: 0.0,
                bottom: 0.0,
                left: 0.0,
            },
            page_ranges: String::new(),
        };

        assert!(validate_options(&options).is_ok());
        options.page_width = MIN_PAGE_SIZE_INCHES - 0.01;
        assert!(validate_options(&options).is_err());
    }

    #[test]
    fn marks_unknown_print_outcomes_for_the_frontend() {
        let error = unknown_print_outcome("confirmation timeout");
        assert_eq!(
            error,
            format!("{PRINT_OUTCOME_UNKNOWN_PREFIX}confirmation timeout")
        );
    }
}
