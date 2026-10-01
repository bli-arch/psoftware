#[derive(Clone, Copy)]
pub enum ProtectionScope {
    CurrentUser,
    LocalMachine,
}

#[cfg(windows)]
pub fn protect(raw: &[u8], scope: ProtectionScope) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::{GetLastError, LocalFree};
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_LOCAL_MACHINE, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: raw
            .len()
            .try_into()
            .map_err(|_| "Data is too large for DPAPI.".to_string())?,
        pbData: raw.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let flags = CRYPTPROTECT_UI_FORBIDDEN
        | match scope {
            ProtectionScope::CurrentUser => 0,
            ProtectionScope::LocalMachine => CRYPTPROTECT_LOCAL_MACHINE,
        };

    if unsafe {
        CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            flags,
            &mut output,
        )
    } == 0
    {
        return Err(format!(
            "DPAPI protection failed (Windows error {}).",
            unsafe { GetLastError() }
        ));
    }

    let protected =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData as _);
    }
    Ok(protected)
}

#[cfg(windows)]
pub fn unprotect(protected: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::{GetLastError, LocalFree};
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: protected
            .len()
            .try_into()
            .map_err(|_| "Protected data is too large for DPAPI.".to_string())?,
        pbData: protected.as_ptr() as *mut u8,
    };
    let mut description = std::ptr::null_mut();
    let mut output = CRYPT_INTEGER_BLOB::default();

    if unsafe {
        CryptUnprotectData(
            &input,
            &mut description,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    } == 0
    {
        return Err(format!(
            "DPAPI decryption failed (Windows error {}).",
            unsafe { GetLastError() }
        ));
    }

    let raw = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData as _);
        if !description.is_null() {
            LocalFree(description as _);
        }
    }
    Ok(raw)
}

#[cfg(not(windows))]
pub fn protect(_raw: &[u8], _scope: ProtectionScope) -> Result<Vec<u8>, String> {
    Err("DPAPI is only available on Windows.".into())
}

#[cfg(not(windows))]
pub fn unprotect(_protected: &[u8]) -> Result<Vec<u8>, String> {
    Err("DPAPI is only available on Windows.".into())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn current_user_round_trip() {
        let raw = b"session-secret";
        let protected = protect(raw, ProtectionScope::CurrentUser).expect("DPAPI protection");

        assert_ne!(protected, raw);
        assert_eq!(unprotect(&protected).expect("DPAPI decryption"), raw);
    }

    #[test]
    fn local_machine_round_trip() {
        let raw = b"machine-secret";
        let protected = protect(raw, ProtectionScope::LocalMachine).expect("DPAPI protection");

        assert_ne!(protected, raw);
        assert_eq!(unprotect(&protected).expect("DPAPI decryption"), raw);
    }
}
