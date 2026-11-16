//! Bridge to the HarborNative Swift package (macos/HarborNative).
//!
//! Swift owns the native window chrome. It never calls Tauri and Rust never
//! touches AppKit types here: state goes down as JSON strings through a small
//! C ABI, and Swift reports user actions through one callback that this module
//! re-emits to the web app as `mac-native://<kind>` events.

use std::ffi::{c_char, c_void, CStr, CString};
use std::sync::OnceLock;

use serde_json::Value;
use tauri::{AppHandle, Emitter};

const ABI_VERSION: i32 = 1;
const EVENT_PREFIX: &str = "mac-native://";

type NativeCallback = extern "C" fn(kind: *const c_char, json: *const c_char);

// Every one of these must be called on the main thread.
extern "C" {
    fn harbor_native_abi_version() -> i32;
    fn harbor_native_install(ns_window: *mut c_void, callback: NativeCallback);
    fn harbor_native_sidebar_set(json: *const c_char);
    fn harbor_native_toolbar_set(json: *const c_char);
    fn harbor_native_search_set(json: *const c_char);
}

static APP: OnceLock<AppHandle> = OnceLock::new();

/// Turns a Swift callback into the Tauri event to emit. Malformed input is
/// dropped rather than forwarded as a guess.
fn native_event(kind: &CStr, json: &CStr) -> Option<(String, Value)> {
    let kind = kind.to_str().ok().filter(|kind| !kind.is_empty())?;
    let payload = serde_json::from_slice(json.to_bytes()).ok()?;
    Some((format!("{EVENT_PREFIX}{kind}"), payload))
}

extern "C" fn on_native_event(kind: *const c_char, json: *const c_char) {
    if kind.is_null() || json.is_null() {
        return;
    }
    // SAFETY: Swift passes NUL-terminated strings that live for this call.
    let event = unsafe { native_event(CStr::from_ptr(kind), CStr::from_ptr(json)) };
    let (Some((name, payload)), Some(app)) = (event, APP.get()) else {
        return;
    };
    if let Err(e) = app.emit(&name, payload) {
        eprintln!("[harbor::mac-native] emit {name} failed: {e}");
    }
}

/// Hands the main window to Swift. Must run on the main thread (Tauri's setup
/// hook does).
pub fn install(app: &AppHandle, ns_window: *mut c_void) {
    if ns_window.is_null() || APP.set(app.clone()).is_err() {
        return;
    }
    // SAFETY: plain C calls into the statically linked Swift package, on the
    // main thread, with a live NSWindow pointer.
    unsafe {
        let version = harbor_native_abi_version();
        if version != ABI_VERSION {
            eprintln!("[harbor::mac-native] ABI {version}, expected {ABI_VERSION}; not installing");
            return;
        }
        harbor_native_install(ns_window, on_native_event);
    }
}

fn push(
    app: &AppHandle,
    payload: String,
    set: unsafe extern "C" fn(*const c_char),
) -> Result<(), String> {
    let json = CString::new(payload).map_err(|e| e.to_string())?;
    // SAFETY: `json` is moved into the closure and outlives the call.
    app.run_on_main_thread(move || unsafe { set(json.as_ptr()) })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mac_native_sidebar_set(app: AppHandle, payload: String) -> Result<(), String> {
    push(&app, payload, harbor_native_sidebar_set)
}

#[tauri::command]
pub fn mac_native_toolbar_set(app: AppHandle, payload: String) -> Result<(), String> {
    push(&app, payload, harbor_native_toolbar_set)
}

#[tauri::command]
pub fn mac_native_search_set(app: AppHandle, payload: String) -> Result<(), String> {
    push(&app, payload, harbor_native_search_set)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swift_library_links() {
        assert_eq!(unsafe { harbor_native_abi_version() }, ABI_VERSION);
    }

    #[test]
    fn native_event_prefixes_kind_and_parses_payload() {
        let event = native_event(c"sidebar-select", c"{\"id\":\"home\"}");
        assert_eq!(
            event,
            Some((
                "mac-native://sidebar-select".to_string(),
                serde_json::json!({ "id": "home" })
            ))
        );
    }

    #[test]
    fn native_event_drops_malformed_input() {
        assert_eq!(native_event(c"layout", c"{not json"), None);
        assert_eq!(native_event(c"", c"{}"), None);
    }
}
