use serde::Serialize;

static CAPABILITY_QUERY: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterCapabilities {
    supports_color: Option<bool>,
    supports_duplex: Option<bool>,
    paper_sizes: Vec<PrinterPaperSize>,
    page_size_supported: bool,
    printable_area: Option<PrintableArea>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PrinterPaperSize {
    name: String,
    width: f64,
    height: f64,
}

#[derive(Debug, Serialize)]
struct PrintableArea {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[tauri::command]
pub async fn get_printer_capabilities(
    printer_name: String,
    page_width: f64,
    page_height: f64,
    orientation: String,
    color: String,
    duplex: bool,
) -> Result<PrinterCapabilities, String> {
    if printer_name.is_empty() || printer_name.encode_utf16().count() > 260 {
        return Err("Le nom de l’imprimante est invalide.".into());
    }
    if !page_width.is_finite()
        || !page_height.is_finite()
        || !(crate::native_print::MIN_PAGE_SIZE_INCHES..=120.0).contains(&page_width)
        || !(crate::native_print::MIN_PAGE_SIZE_INCHES..=120.0).contains(&page_height)
    {
        return Err("Le format de papier est invalide.".into());
    }
    let landscape = match orientation.as_str() {
        "portrait" => false,
        "landscape" => true,
        _ => return Err("L’orientation est invalide.".into()),
    };
    let color = match color.as_str() {
        "color" => true,
        "grayscale" => false,
        _ => return Err("Le mode de couleur est invalide.".into()),
    };
    let _guard = CAPABILITY_QUERY.lock().await;
    tokio::task::spawn_blocking(move || {
        if !crate::native_print::printer_is_installed(&printer_name)? {
            return Err("L’imprimante sélectionnée n’est plus disponible.".into());
        }
        platform::query(
            &printer_name,
            page_width,
            page_height,
            landscape,
            color,
            duplex,
        )
    })
    .await
    .map_err(|_| "La lecture des capacités de l’imprimante a été interrompue.".to_string())?
}

#[cfg(windows)]
mod platform {
    use std::mem::size_of;
    use std::slice;

    use windows::core::{w, PCWSTR, PWSTR};
    use windows::Win32::Graphics::Gdi::{
        CreateDCW, DeleteDC, GetDeviceCaps, DEVMODEW, DEVMODE_FIELD_FLAGS, DMCOLOR_COLOR,
        DMCOLOR_MONOCHROME, DMDUP_SIMPLEX, DMDUP_VERTICAL, DMORIENT_LANDSCAPE, DMORIENT_PORTRAIT,
        DM_COLOR, DM_DUPLEX, DM_FORMNAME, DM_IN_BUFFER, DM_ORIENTATION, DM_OUT_BUFFER,
        DM_PAPERLENGTH, DM_PAPERSIZE, DM_PAPERWIDTH, HORZRES, LOGPIXELSX, LOGPIXELSY,
        PHYSICALHEIGHT, PHYSICALOFFSETX, PHYSICALOFFSETY, PHYSICALWIDTH, VERTRES,
    };
    use windows::Win32::Graphics::Printing::{
        ClosePrinter, DocumentPropertiesW, EnumFormsW, GetPrinterW, IsValidDevmodeW, OpenPrinterW,
        FORM_INFO_1W, PRINTER_HANDLE, PRINTER_INFO_5W,
    };
    use windows::Win32::Storage::Xps::{DeviceCapabilitiesW, DC_COLORDEVICE, DC_DUPLEX};

    use super::{PrintableArea, PrinterCapabilities, PrinterPaperSize};

    const MAX_DRIVER_BUFFER: usize = 8 * 1024 * 1024;
    const FORM_UNITS_PER_INCH: f64 = 25_400.0;
    const PAPER_MATCH_TOLERANCE: f64 = 0.04;
    const PAGE_MATCH_TOLERANCE: f64 = 0.1;

    struct Printer(PRINTER_HANDLE);

    impl Drop for Printer {
        fn drop(&mut self) {
            unsafe {
                let _ = ClosePrinter(self.0);
            }
        }
    }

    struct Form {
        name: String,
        width: f64,
        height: f64,
    }

    pub fn query(
        printer_name: &str,
        page_width: f64,
        page_height: f64,
        landscape: bool,
        color: bool,
        duplex: bool,
    ) -> Result<PrinterCapabilities, String> {
        let printer_name_wide = wide(printer_name);
        let printer = open_printer(PCWSTR(printer_name_wide.as_ptr()))?;
        let forms = enumerate_forms(&printer)?;
        let requested_form = forms.iter().find(|form| {
            dimensions_match(
                form.width,
                form.height,
                page_width,
                page_height,
                PAPER_MATCH_TOLERANCE,
            )
        });
        let port = printer_port(&printer);
        let (supports_color, supports_duplex) = port.as_ref().map_or((None, None), |port| {
            let port = PCWSTR(port.as_ptr());
            (
                binary_capability(PCWSTR(printer_name_wide.as_ptr()), port, DC_COLORDEVICE),
                binary_capability(PCWSTR(printer_name_wide.as_ptr()), port, DC_DUPLEX),
            )
        });
        let printable_area = query_printable_area(
            &printer,
            PCWSTR(printer_name_wide.as_ptr()),
            page_width,
            page_height,
            landscape,
            color,
            duplex,
        );

        Ok(PrinterCapabilities {
            supports_color,
            supports_duplex,
            paper_sizes: forms
                .iter()
                .map(|form| PrinterPaperSize {
                    name: form.name.clone(),
                    width: form.width,
                    height: form.height,
                })
                .collect(),
            page_size_supported: requested_form.is_some(),
            printable_area,
        })
    }

    fn open_printer(name: PCWSTR) -> Result<Printer, String> {
        let mut handle = PRINTER_HANDLE::default();
        unsafe { OpenPrinterW(name, &mut handle, None) }
            .map_err(|error| format!("Impossible d’interroger l’imprimante : {error}"))?;
        Ok(Printer(handle))
    }

    fn enumerate_forms(printer: &Printer) -> Result<Vec<Form>, String> {
        let mut needed = 0;
        let mut returned = 0;
        let initial = unsafe { EnumFormsW(printer.0, 1, None, &mut needed, &mut returned) };
        if needed == 0 {
            return if initial.as_bool() {
                Ok(Vec::new())
            } else {
                Err(format!(
                    "Impossible de lire les formats de l’imprimante : {}",
                    windows::core::Error::from_win32(),
                ))
            };
        }
        let mut storage = None;
        for _ in 0..2 {
            let mut candidate = aligned_buffer(needed as usize)?;
            let capacity = std::mem::size_of_val(candidate.as_slice());
            let result = unsafe {
                EnumFormsW(
                    printer.0,
                    1,
                    Some(as_bytes(&mut candidate)),
                    &mut needed,
                    &mut returned,
                )
            };
            if result.as_bool() {
                storage = Some(candidate);
                break;
            }
            if needed as usize <= capacity {
                return Err(format!(
                    "Impossible de lire les formats de l’imprimante : {}",
                    windows::core::Error::from_win32(),
                ));
            }
        }
        let storage = storage.ok_or_else(|| {
            "La liste des formats de l’imprimante a changé pendant sa lecture.".to_string()
        })?;
        let byte_length = std::mem::size_of_val(storage.as_slice());

        let available = byte_length / size_of::<FORM_INFO_1W>();
        let count = (returned as usize).min(available);
        let entries =
            unsafe { slice::from_raw_parts(storage.as_ptr().cast::<FORM_INFO_1W>(), count) };
        let mut forms = entries
            .iter()
            .filter_map(|entry| {
                let name = wide_string_in_buffer(entry.pName, &storage)?;
                let width = entry.Size.cx as f64 / FORM_UNITS_PER_INCH;
                let height = entry.Size.cy as f64 / FORM_UNITS_PER_INCH;
                valid_dimensions(width, height).then_some(Form {
                    name,
                    width,
                    height,
                })
            })
            .collect::<Vec<_>>();
        forms.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        Ok(forms)
    }

    fn printer_port(printer: &Printer) -> Option<Vec<u16>> {
        let mut needed = 0;
        unsafe {
            let _ = GetPrinterW(printer.0, 5, None, &mut needed);
        }
        let mut storage = None;
        for _ in 0..2 {
            let mut candidate = aligned_buffer(needed as usize).ok()?;
            let capacity = std::mem::size_of_val(candidate.as_slice());
            if unsafe { GetPrinterW(printer.0, 5, Some(as_bytes(&mut candidate)), &mut needed) }
                .is_ok()
            {
                storage = Some(candidate);
                break;
            }
            if needed as usize <= capacity {
                return None;
            }
        }
        let storage = storage?;
        if std::mem::size_of_val(storage.as_slice()) < size_of::<PRINTER_INFO_5W>() {
            return None;
        }
        let info = unsafe { &*storage.as_ptr().cast::<PRINTER_INFO_5W>() };
        wide_string_in_buffer(info.pPortName, &storage).map(|value| wide(&value))
    }

    fn binary_capability(
        printer_name: PCWSTR,
        port: PCWSTR,
        capability: windows::Win32::Storage::Xps::PRINTER_DEVICE_CAPABILITIES,
    ) -> Option<bool> {
        match unsafe { DeviceCapabilitiesW(printer_name, port, capability, None, None) } {
            -1 => None,
            value => Some(value > 0),
        }
    }

    fn query_printable_area(
        printer: &Printer,
        printer_name: PCWSTR,
        requested_width: f64,
        requested_height: f64,
        landscape: bool,
        color: bool,
        duplex: bool,
    ) -> Option<PrintableArea> {
        let size = unsafe { DocumentPropertiesW(None, printer.0, printer_name, None, None, 0) };
        if size < size_of::<DEVMODEW>() as i32 {
            return None;
        }
        let mut storage = aligned_buffer(size as usize).ok()?;
        let devmode = storage.as_mut_ptr().cast::<DEVMODEW>();
        if unsafe {
            DocumentPropertiesW(
                None,
                printer.0,
                printer_name,
                Some(devmode),
                None,
                DM_OUT_BUFFER.0,
            )
        } != 1
            || !unsafe { IsValidDevmodeW(Some(devmode), size as usize) }.as_bool()
        {
            return None;
        }

        let paper_width = i16::try_from((requested_width * 254.0).round() as i32).ok()?;
        let paper_height = i16::try_from((requested_height * 254.0).round() as i32).ok()?;
        unsafe {
            (*devmode).dmFormName.fill(0);
            (*devmode).dmFields = DEVMODE_FIELD_FLAGS(
                ((*devmode).dmFields.0
                    & !(DM_FORMNAME.0 | DM_PAPERSIZE.0 | DM_PAPERWIDTH.0 | DM_PAPERLENGTH.0))
                    | DM_PAPERWIDTH.0
                    | DM_PAPERLENGTH.0
                    | DM_ORIENTATION.0
                    | DM_COLOR.0
                    | DM_DUPLEX.0,
            );
            let settings = &mut (*devmode).Anonymous1.Anonymous1;
            settings.dmPaperSize = 0;
            settings.dmPaperWidth = paper_width;
            settings.dmPaperLength = paper_height;
            settings.dmOrientation = if landscape {
                DMORIENT_LANDSCAPE as i16
            } else {
                DMORIENT_PORTRAIT as i16
            };
            (*devmode).dmColor = if color {
                DMCOLOR_COLOR
            } else {
                DMCOLOR_MONOCHROME
            };
            (*devmode).dmDuplex = if duplex {
                DMDUP_VERTICAL
            } else {
                DMDUP_SIMPLEX
            };
        }
        if unsafe {
            DocumentPropertiesW(
                None,
                printer.0,
                printer_name,
                Some(devmode),
                Some(devmode),
                (DM_IN_BUFFER.0 | DM_OUT_BUFFER.0) as u32,
            )
        } != 1
            || !unsafe { IsValidDevmodeW(Some(devmode), size as usize) }.as_bool()
        {
            return None;
        }

        let context =
            unsafe { CreateDCW(w!("WINSPOOL"), printer_name, PCWSTR::null(), Some(devmode)) };
        if context.is_invalid() {
            return None;
        }
        let physical_width = unsafe { GetDeviceCaps(Some(context), PHYSICALWIDTH) };
        let physical_height = unsafe { GetDeviceCaps(Some(context), PHYSICALHEIGHT) };
        let offset_x = unsafe { GetDeviceCaps(Some(context), PHYSICALOFFSETX) };
        let offset_y = unsafe { GetDeviceCaps(Some(context), PHYSICALOFFSETY) };
        let printable_width = unsafe { GetDeviceCaps(Some(context), HORZRES) };
        let printable_height = unsafe { GetDeviceCaps(Some(context), VERTRES) };
        let dpi_x = unsafe { GetDeviceCaps(Some(context), LOGPIXELSX) };
        let dpi_y = unsafe { GetDeviceCaps(Some(context), LOGPIXELSY) };
        unsafe {
            let _ = DeleteDC(context);
        }
        if physical_width <= 0
            || physical_height <= 0
            || printable_width <= 0
            || printable_height <= 0
            || offset_x < 0
            || offset_y < 0
            || dpi_x <= 0
            || dpi_y <= 0
        {
            return None;
        }

        let page_width = physical_width as f64 / dpi_x as f64;
        let page_height = physical_height as f64 / dpi_y as f64;
        let expected = if landscape {
            (requested_height, requested_width)
        } else {
            (requested_width, requested_height)
        };
        if !dimensions_match_oriented(
            page_width,
            page_height,
            expected.0,
            expected.1,
            PAGE_MATCH_TOLERANCE,
        ) {
            return None;
        }

        let x = offset_x as f64 / dpi_x as f64;
        let y = offset_y as f64 / dpi_y as f64;
        let width = printable_width as f64 / dpi_x as f64;
        let height = printable_height as f64 / dpi_y as f64;
        (x < page_width
            && y < page_height
            && page_width - x > 0.0
            && page_height - y > 0.0
            && x + width <= page_width + PAGE_MATCH_TOLERANCE
            && y + height <= page_height + PAGE_MATCH_TOLERANCE)
            .then_some(PrintableArea {
                x,
                y,
                width: width.min(page_width - x),
                height: height.min(page_height - y),
            })
    }

    fn aligned_buffer(byte_count: usize) -> Result<Vec<usize>, String> {
        if byte_count == 0 || byte_count > MAX_DRIVER_BUFFER {
            return Err("La réponse du pilote d’impression est invalide.".into());
        }
        let word_count = byte_count.div_ceil(size_of::<usize>());
        Ok(vec![0usize; word_count])
    }

    fn as_bytes(storage: &mut [usize]) -> &mut [u8] {
        unsafe {
            slice::from_raw_parts_mut(
                storage.as_mut_ptr().cast::<u8>(),
                std::mem::size_of_val(storage),
            )
        }
    }

    fn wide_string_in_buffer(pointer: PWSTR, storage: &[usize]) -> Option<String> {
        let start = storage.as_ptr() as usize;
        let end = start.checked_add(std::mem::size_of_val(storage))?;
        let pointer = pointer.0 as usize;
        if pointer < start || pointer >= end || pointer % size_of::<u16>() != 0 {
            return None;
        }
        let max_length = (end - pointer) / size_of::<u16>();
        let characters = unsafe { slice::from_raw_parts(pointer as *const u16, max_length) };
        let length = characters.iter().position(|character| *character == 0)?;
        String::from_utf16(&characters[..length]).ok()
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn valid_dimensions(width: f64, height: f64) -> bool {
        width.is_finite()
            && height.is_finite()
            && (crate::native_print::MIN_PAGE_SIZE_INCHES..=120.0).contains(&width)
            && (crate::native_print::MIN_PAGE_SIZE_INCHES..=120.0).contains(&height)
    }

    fn dimensions_match(
        left_width: f64,
        left_height: f64,
        right_width: f64,
        right_height: f64,
        tolerance: f64,
    ) -> bool {
        let direct = (left_width - right_width).abs() <= tolerance
            && (left_height - right_height).abs() <= tolerance;
        let rotated = (left_width - right_height).abs() <= tolerance
            && (left_height - right_width).abs() <= tolerance;
        direct || rotated
    }

    fn dimensions_match_oriented(
        left_width: f64,
        left_height: f64,
        right_width: f64,
        right_height: f64,
        tolerance: f64,
    ) -> bool {
        (left_width - right_width).abs() <= tolerance
            && (left_height - right_height).abs() <= tolerance
    }
}

#[cfg(not(windows))]
mod platform {
    use super::PrinterCapabilities;

    pub fn query(
        _printer_name: &str,
        _page_width: f64,
        _page_height: f64,
        _landscape: bool,
        _color: bool,
        _duplex: bool,
    ) -> Result<PrinterCapabilities, String> {
        Err("La lecture des capacités n’est actuellement disponible que sous Windows.".into())
    }
}
