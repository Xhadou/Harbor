//! Where Harbor keeps sign-ins, tokens and API keys: one JSON document that only
//! the web side reads and writes as a whole (`secrets_read` / `secrets_write`).
//!
//! A signed macOS build keeps it in the login keychain, as one item named after the
//! app's identifier. Everywhere else, and in debug builds on macOS, it is a file in
//! the app's data folder that only this user can read. Debug builds stay off the
//! keychain because each rebuild is signed afresh, and macOS asks for the login
//! password before a differently signed program may read an item; that prompt
//! would hold the app up on every launch. `HARBOR_SECRETS=keychain` opts a debug
//! build in.
//!
//! The first keychain read moves an existing file into the keychain and deletes
//! the file once the keychain gives the same document back.

use std::path::{Path, PathBuf};
use tauri::Manager;

const FILE_NAME: &str = "secrets.json";

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join(FILE_NAME))
}

fn read_file(path: &Path) -> Result<Option<String>, String> {
    match std::fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Writes through a temporary file that is created readable by this user only, so
/// the content is never on disk with wider permissions, even for a moment.
pub(crate) fn write_private_file(path: &Path, content: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let tmp = path.with_extension("json.tmp");
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&tmp).map_err(|e| e.to_string())?;
    // A temporary file left by an older build keeps its old mode when reopened.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    file.write_all(content).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
mod keychain {
    use security_framework::passwords::{get_generic_password, set_generic_password};

    /// `errSecItemNotFound`.
    const NOT_FOUND: i32 = -25300;
    const ACCOUNT: &str = "secrets";

    pub(super) fn wanted() -> bool {
        !cfg!(debug_assertions) || std::env::var("HARBOR_SECRETS").as_deref() == Ok("keychain")
    }

    /// The app's identifier; a debug build opted in keeps its own item, apart from the
    /// installed app's.
    pub(super) fn service(app: &tauri::AppHandle) -> String {
        let id = &app.config().identifier;
        if cfg!(debug_assertions) {
            format!("{id}.dev")
        } else {
            id.clone()
        }
    }

    pub(super) fn get(service: &str) -> Result<Option<Vec<u8>>, String> {
        match get_generic_password(service, ACCOUNT) {
            Ok(bytes) => Ok(Some(bytes)),
            Err(e) if e.code() == NOT_FOUND => Ok(None),
            Err(e) => Err(format!("keychain read failed: {e}")),
        }
    }

    pub(super) fn set(service: &str, content: &[u8]) -> Result<(), String> {
        set_generic_password(service, ACCOUNT, content)
            .map_err(|e| format!("keychain write failed: {e}"))
    }
}

#[cfg(target_os = "macos")]
fn read_keychain(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let service = keychain::service(app);
    let path = file_path(app)?;
    if let Some(bytes) = keychain::get(&service)? {
        // A file next to a keychain item is a leftover (a debug build's, or a move cut
        // short); the keychain is the copy that counts.
        if path.exists() {
            let _ = std::fs::remove_file(&path);
        }
        return String::from_utf8(bytes)
            .map(Some)
            .map_err(|e| e.to_string());
    }
    let Some(content) = read_file(&path)? else {
        return Ok(None);
    };
    match keychain::set(&service, content.as_bytes()) {
        Ok(()) if keychain::get(&service)?.as_deref() == Some(content.as_bytes()) => {
            let _ = std::fs::remove_file(&path);
        }
        Ok(()) => eprintln!("[secrets] the keychain did not give the moved secrets back"),
        Err(e) => eprintln!("[secrets] {e}; keeping the file"),
    }
    Ok(Some(content))
}

pub(crate) fn read(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    if keychain::wanted() {
        return read_keychain(app);
    }
    read_file(&file_path(app)?)
}

pub(crate) fn write(app: &tauri::AppHandle, content: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if keychain::wanted() {
        return keychain::set(&keychain::service(app), content.as_bytes());
    }
    write_private_file(&file_path(app)?, content.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_file_is_readable_by_its_owner_only() {
        let dir = std::env::temp_dir().join(format!("harbor-vault-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("secrets.json");
        // An older build's file, readable by everyone, is replaced, not reused.
        std::fs::write(&path, "{}").unwrap();
        write_private_file(&path, br#"{"a":"b"}"#).unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), r#"{"a":"b"}"#);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn keychain_round_trip() {
        let service = format!("app.harbor.test.{}", std::process::id());
        assert_eq!(keychain::get(&service).unwrap(), None);
        keychain::set(&service, b"one").unwrap();
        keychain::set(&service, b"two").unwrap();
        assert_eq!(
            keychain::get(&service).unwrap().as_deref(),
            Some(&b"two"[..])
        );
        security_framework::passwords::delete_generic_password(&service, "secrets").unwrap();
        assert_eq!(keychain::get(&service).unwrap(), None);
    }
}
