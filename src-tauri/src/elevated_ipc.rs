const MAX_MESSAGE_SIZE: usize = 1024 * 1024;

#[cfg(windows)]
mod windows {
    use super::MAX_MESSAGE_SIZE;
    use std::io;
    use std::mem;
    use std::ptr;
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, LocalFree, ERROR_PIPE_CONNECTED, GENERIC_READ, GENERIC_WRITE,
        HANDLE, INVALID_HANDLE_VALUE,
    };
    use windows_sys::Win32::Security::Authorization::{
        ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use windows_sys::Win32::Security::Cryptography::{
        BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
    };
    use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, ReadFile, WriteFile, FILE_ATTRIBUTE_NORMAL, FILE_FLAG_FIRST_PIPE_INSTANCE,
        OPEN_EXISTING, PIPE_ACCESS_DUPLEX,
    };
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
        PIPE_TYPE_BYTE, PIPE_WAIT,
    };

    pub struct Server {
        handle: HANDLE,
        name: String,
    }

    pub struct Channel(HANDLE);

    impl Server {
        pub fn create() -> Result<Self, String> {
            let mut nonce = [0u8; 32];
            let status = unsafe {
                BCryptGenRandom(
                    ptr::null_mut(),
                    nonce.as_mut_ptr(),
                    nonce.len() as u32,
                    BCRYPT_USE_SYSTEM_PREFERRED_RNG,
                )
            };
            if status < 0 {
                return Err(format!(
                    "Impossible de sécuriser le canal administrateur: {status}."
                ));
            }
            let name = format!(
                r"\\.\pipe\PSoft.PServerInstall.{}",
                nonce
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect::<String>()
            );
            let wide_name = wide(&name);
            let mut descriptor = ptr::null_mut();
            let sddl = wide("D:P(A;;GA;;;SY)(A;;GA;;;BA)");
            if unsafe {
                ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    sddl.as_ptr(),
                    SDDL_REVISION_1,
                    &mut descriptor,
                    ptr::null_mut(),
                )
            } == 0
            {
                return Err(last_error(
                    "Impossible de sécuriser le canal administrateur",
                ));
            }
            let attributes = SECURITY_ATTRIBUTES {
                nLength: mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: descriptor,
                bInheritHandle: 0,
            };
            let handle = unsafe {
                CreateNamedPipeW(
                    wide_name.as_ptr(),
                    PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                    PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                    1,
                    64 * 1024,
                    64 * 1024,
                    0,
                    &attributes,
                )
            };
            unsafe {
                LocalFree(descriptor);
            }
            if handle == INVALID_HANDLE_VALUE {
                return Err(last_error("Impossible de créer le canal administrateur"));
            }
            Ok(Self { handle, name })
        }

        pub fn name(&self) -> &str {
            &self.name
        }

        pub fn accept(mut self) -> Result<Channel, String> {
            if unsafe { ConnectNamedPipe(self.handle, ptr::null_mut()) } == 0
                && unsafe { GetLastError() } != ERROR_PIPE_CONNECTED
            {
                return Err(last_error("Impossible d'ouvrir le canal administrateur"));
            }
            let handle = self.handle;
            self.handle = INVALID_HANDLE_VALUE;
            Ok(Channel(handle))
        }
    }

    impl Drop for Server {
        fn drop(&mut self) {
            close(self.handle);
        }
    }

    impl Channel {
        pub fn connect(name: &str) -> Result<Self, String> {
            if !valid_pipe_name(name) {
                return Err("Canal administrateur invalide.".into());
            }
            let name = wide(name);
            let handle = unsafe {
                CreateFileW(
                    name.as_ptr(),
                    GENERIC_READ | GENERIC_WRITE,
                    0,
                    ptr::null(),
                    OPEN_EXISTING,
                    FILE_ATTRIBUTE_NORMAL,
                    ptr::null_mut(),
                )
            };
            if handle == INVALID_HANDLE_VALUE {
                return Err(last_error(
                    "Impossible de rejoindre le canal administrateur",
                ));
            }
            Ok(Self(handle))
        }

        pub fn send(&self, message: &[u8]) -> Result<(), String> {
            if message.len() > MAX_MESSAGE_SIZE {
                return Err("Message administrateur trop volumineux.".into());
            }
            self.write_all(&(message.len() as u32).to_le_bytes())?;
            self.write_all(message)
        }

        pub fn receive(&self) -> Result<Vec<u8>, String> {
            let mut header = [0u8; 4];
            self.read_exact(&mut header)?;
            let length = u32::from_le_bytes(header) as usize;
            if length > MAX_MESSAGE_SIZE {
                return Err("Message administrateur trop volumineux.".into());
            }
            let mut message = vec![0; length];
            self.read_exact(&mut message)?;
            Ok(message)
        }

        fn read_exact(&self, mut buffer: &mut [u8]) -> Result<(), String> {
            while !buffer.is_empty() {
                let mut read = 0;
                let chunk = buffer.len().min(u32::MAX as usize) as u32;
                if unsafe {
                    ReadFile(
                        self.0,
                        buffer.as_mut_ptr(),
                        chunk,
                        &mut read,
                        ptr::null_mut(),
                    )
                } == 0
                {
                    return Err(last_error("Impossible de lire le canal administrateur"));
                }
                if read == 0 {
                    return Err("Le canal administrateur a été fermé prématurément.".into());
                }
                buffer = &mut buffer[read as usize..];
            }
            Ok(())
        }

        fn write_all(&self, mut buffer: &[u8]) -> Result<(), String> {
            while !buffer.is_empty() {
                let mut written = 0;
                let chunk = buffer.len().min(u32::MAX as usize) as u32;
                if unsafe {
                    WriteFile(
                        self.0,
                        buffer.as_ptr(),
                        chunk,
                        &mut written,
                        ptr::null_mut(),
                    )
                } == 0
                {
                    return Err(last_error(
                        "Impossible d'écrire dans le canal administrateur",
                    ));
                }
                if written == 0 {
                    return Err("Le canal administrateur a été fermé prématurément.".into());
                }
                buffer = &buffer[written as usize..];
            }
            Ok(())
        }
    }

    impl Drop for Channel {
        fn drop(&mut self) {
            close(self.0);
        }
    }

    fn valid_pipe_name(name: &str) -> bool {
        let Some(nonce) = name.strip_prefix(r"\\.\pipe\PSoft.PServerInstall.") else {
            return false;
        };
        nonce.len() == 64 && nonce.bytes().all(|byte| byte.is_ascii_hexdigit())
    }

    fn close(handle: HANDLE) {
        if handle != INVALID_HANDLE_VALUE && !handle.is_null() {
            unsafe {
                CloseHandle(handle);
            }
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain([0]).collect()
    }

    fn last_error(context: &str) -> String {
        format!("{context}: {}", io::Error::last_os_error())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn creates_unique_local_pipe_names() {
            let first = Server::create().expect("create first server");
            let second = Server::create().expect("create second server");
            assert!(valid_pipe_name(first.name()));
            assert!(valid_pipe_name(second.name()));
            assert_ne!(first.name(), second.name());
        }

        #[test]
        fn rejects_untrusted_pipe_names() {
            assert!(!valid_pipe_name(r"\\.\pipe\another-app"));
            assert!(!valid_pipe_name(r"\\server\pipe\PSoft.PServerInstall.00"));
        }
    }
}

#[cfg(windows)]
pub use windows::{Channel, Server};

#[cfg(not(windows))]
pub struct Server;

#[cfg(not(windows))]
pub struct Channel;

#[cfg(not(windows))]
impl Server {
    pub fn create() -> Result<Self, String> {
        Err("Le canal administrateur est disponible uniquement sur Windows.".into())
    }

    pub fn name(&self) -> &str {
        ""
    }

    pub fn accept(self) -> Result<Channel, String> {
        Err("Le canal administrateur est disponible uniquement sur Windows.".into())
    }
}

#[cfg(not(windows))]
impl Channel {
    pub fn connect(_name: &str) -> Result<Self, String> {
        Err("Le canal administrateur est disponible uniquement sur Windows.".into())
    }

    pub fn send(&self, _message: &[u8]) -> Result<(), String> {
        Err("Le canal administrateur est disponible uniquement sur Windows.".into())
    }

    pub fn receive(&self) -> Result<Vec<u8>, String> {
        Err("Le canal administrateur est disponible uniquement sur Windows.".into())
    }
}
