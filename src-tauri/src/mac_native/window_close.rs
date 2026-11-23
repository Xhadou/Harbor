//! On a Mac, closing the main window is not quitting.
//!
//! The red button and ⌘W put the window away and leave Harbor running in the
//! Dock; clicking the Dock icon, or using any menu command, brings it back as
//! it was. Only Quit (⌘Q) ends the app.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, Window};

/// Sent to the page when the window is put away: it pauses playback, leaves
/// full screen and saves what it would save on quit.
const WINDOW_CLOSED_EVENT: &str = "harbor://window-closed";

const POLL: Duration = Duration::from_millis(50);
/// How long the page gets to leave full screen by its own path before this
/// module asks the system to.
const PAGE_GRACE_POLLS: u32 = 12;
/// A full-screen exit animates for well under a second; past this the window
/// is put away regardless.
const MAX_POLLS: u32 = 80;

/// How many times the window has finished leaving full screen.
static EXITS_FINISHED: AtomicU64 = AtomicU64::new(0);

/// Whether a `fullscreen` report from Swift says the window has finished
/// leaving full screen, as opposed to having begun to.
fn is_finished_exit(payload: &Value) -> bool {
    payload.get("on").and_then(Value::as_bool) == Some(false)
        && payload.get("settled").and_then(Value::as_bool) == Some(true)
}

/// Called with every `fullscreen` report Swift makes.
pub fn note_full_screen_report(payload: &Value) {
    if is_finished_exit(payload) {
        EXITS_FINISHED.fetch_add(1, Ordering::SeqCst);
    }
}

/// Call from the main window's close request, after preventing the close.
pub fn put_away(window: &Window) {
    let _ = window.emit(WINDOW_CLOSED_EVENT, ());
    if !window.is_fullscreen().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    // Hiding a full-screen window leaves its empty Space behind, and one hidden
    // while it animates out is shown again by the system when the animation
    // ends. So the window is put away once it has finished leaving full screen.
    // Tauri cannot say when that is: its answer turns false the moment an exit
    // is asked for. Swift's report can.
    let exits_before = EXITS_FINISHED.load(Ordering::SeqCst);
    let window = window.clone();
    std::thread::spawn(move || {
        for poll in 0..MAX_POLLS {
            if EXITS_FINISHED.load(Ordering::SeqCst) != exits_before {
                break;
            }
            if poll == PAGE_GRACE_POLLS && window.is_fullscreen().unwrap_or(false) {
                let _ = window.set_fullscreen(false);
            }
            std::thread::sleep(POLL);
        }
        let _ = window.hide();
    });
}

/// Brings the main window back if it was put away. Returns whether it had to.
pub fn bring_back(app: &AppHandle) -> bool {
    let Some(window) = app.get_webview_window("main") else {
        return false;
    };
    if window.is_visible().unwrap_or(true) {
        return false;
    }
    let _ = window.show();
    let _ = window.set_focus();
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_a_settled_report_of_leaving_counts_as_a_finished_exit() {
        assert!(is_finished_exit(&json!({ "on": false, "settled": true })));
        assert!(!is_finished_exit(&json!({ "on": false, "settled": false })));
        assert!(!is_finished_exit(&json!({ "on": true, "settled": true })));
        assert!(!is_finished_exit(&json!({ "on": false })));
    }
}
