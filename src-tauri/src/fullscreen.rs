use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Clone, Copy, Debug, PartialEq)]
struct SavedGeometry {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
}

// macOS remembers a window's frame when it goes full screen and animates back
// to it on the way out. A snapshot of our own is worse than redundant there:
// re-applying it lands in the middle of that animation, and one taken while
// the window is still shrinking records the screen's size as the size to
// return to. Other platforms have no such memory, so they keep the snapshot.
const OS_RESTORES_FRAME: bool = cfg!(target_os = "macos");

#[derive(Debug, PartialEq)]
enum Restore {
    Nothing,
    Maximize,
    Bounds(SavedGeometry),
    DefaultSize,
}

fn restore_after_exit(
    saved: Option<&SavedWindowState>,
    was_fullscreen: bool,
    os_restores_frame: bool,
) -> Restore {
    if os_restores_frame {
        return Restore::Nothing;
    }
    match saved {
        None => Restore::Nothing,
        Some(saved) if saved.maximized => Restore::Maximize,
        Some(saved) => match saved.geometry {
            Some(geometry) => Restore::Bounds(geometry),
            None if was_fullscreen => Restore::DefaultSize,
            None => Restore::Nothing,
        },
    }
}

struct SavedWindowState {
    // Whether the window was maximized before fullscreen. When true the window
    // is restored by re-maximizing; the normal (restored) bounds of a maximized
    // window are owned by the OS and cannot be read via the window API.
    maximized: bool,
    geometry: Option<SavedGeometry>,
}

pub struct FullscreenState {
    saved: Arc<Mutex<Option<SavedWindowState>>>,
}

impl FullscreenState {
    pub fn new() -> Self {
        Self {
            saved: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn window_fullscreen_enter(
    app: AppHandle,
    state: State<'_, FullscreenState>,
) -> Result<(), String> {
    run_window_transition(&app, Arc::clone(&state.saved), enter_fullscreen).await
}

// Tauri setters called from an async command only enqueue window messages.
// Keep the bounds reads and writes in one window-thread operation: otherwise a
// simultaneous player reassert can save fullscreen dimensions as restore bounds.
async fn run_window_transition(
    app: &AppHandle,
    saved: Arc<Mutex<Option<SavedWindowState>>>,
    transition: impl FnOnce(&tauri::WebviewWindow, &Mutex<Option<SavedWindowState>>) -> Result<(), String>
        + Send
        + 'static,
) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(transition(&main, &saved));
    })
    .map_err(|e| format!("fullscreen transition dispatch: {}", e))?;
    rx.await
        .map_err(|e| format!("fullscreen transition result: {}", e))?
}

fn enter_fullscreen(
    main: &tauri::WebviewWindow,
    saved: &Mutex<Option<SavedWindowState>>,
) -> Result<(), String> {
    let already_fs = main.is_fullscreen().unwrap_or(false);
    if !already_fs {
        #[cfg(windows)]
        crate::window_placement::pause_for_transition(main.app_handle(), true);
        if !OS_RESTORES_FRAME {
            // The OS owns a maximized window's restored bounds. Save its mode before
            // unmaximizing instead of capturing the maximized dimensions.
            let maximized = main.is_maximized().unwrap_or(false);
            if maximized {
                let _ = main.unmaximize();
            }
            let geometry = if maximized {
                None
            } else if let (Ok(pos), Ok(sz)) = (main.outer_position(), main.inner_size()) {
                Some(SavedGeometry {
                    x: pos.x,
                    y: pos.y,
                    w: sz.width,
                    h: sz.height,
                })
            } else {
                None
            };
            let mut saved = saved.lock().unwrap();
            // Preserve the original snapshot if the OS temporarily drops fullscreen
            // and the player reasserts it before the user has actually exited.
            saved.get_or_insert(SavedWindowState { maximized, geometry });
        }
        main.set_fullscreen(true)
            .map_err(|e| format!("set_fullscreen(true): {}", e))?;
        let _ = main.set_focus();
    }
    let _ = main.app_handle().emit_to("main", "fs://entered", ());
    Ok(())
}

#[tauri::command]
pub async fn window_fullscreen_exit(
    app: AppHandle,
    state: State<'_, FullscreenState>,
    restore_position: Option<bool>,
) -> Result<(), String> {
    run_window_transition(&app, Arc::clone(&state.saved), move |main, saved| {
        exit_fullscreen(main, saved, restore_position.unwrap_or(true))
    })
    .await
}

fn exit_fullscreen(
    main: &tauri::WebviewWindow,
    saved: &Mutex<Option<SavedWindowState>>,
    restore_position: bool,
) -> Result<(), String> {
    let is_fs = main.is_fullscreen().unwrap_or(false);
    #[cfg(windows)]
    crate::window_placement::pause_for_transition(main.app_handle(), false);
    if is_fs {
        main.set_fullscreen(false)
            .map_err(|e| format!("set_fullscreen(false): {}", e))?;
    }

    // Restore even when the window is already unfullscreen'd: frontend paths
    // like exitAnyFullscreen call setFullscreen(false) directly before this
    // command runs, and the saved geometry must still be applied.
    let saved = saved.lock().unwrap().take();
    match restore_after_exit(saved.as_ref(), is_fs, OS_RESTORES_FRAME) {
        Restore::Nothing => {}
        Restore::Maximize => {
            let _ = main.maximize();
        }
        Restore::Bounds(geo) => {
            let _ = main.set_size(tauri::PhysicalSize {
                width: geo.w,
                height: geo.h,
            });
            if restore_position {
                let _ = main.set_position(tauri::PhysicalPosition { x: geo.x, y: geo.y });
            } else {
                let _ = main.center();
            }
        }
        Restore::DefaultSize => {
            let _ = main.set_size(tauri::LogicalSize { width: 1280.0, height: 800.0 });
            let _ = main.center();
        }
    }
    if saved.is_some() {
        let _ = main.set_focus();
    }
    let _ = main.app_handle().emit_to("main", "fs://exited", ());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const WINDOWED: SavedGeometry = SavedGeometry {
        x: 95,
        y: 95,
        w: 2560,
        h: 1600,
    };

    fn saved(maximized: bool, geometry: Option<SavedGeometry>) -> SavedWindowState {
        SavedWindowState { maximized, geometry }
    }

    #[test]
    fn a_window_the_os_restores_is_never_resized_or_moved_on_exit() {
        let bounds = saved(false, Some(WINDOWED));
        assert_eq!(restore_after_exit(Some(&bounds), true, true), Restore::Nothing);
        let maximized = saved(true, None);
        assert_eq!(restore_after_exit(Some(&maximized), true, true), Restore::Nothing);
        let unknown = saved(false, None);
        assert_eq!(restore_after_exit(Some(&unknown), true, true), Restore::Nothing);
    }

    #[test]
    fn elsewhere_the_snapshot_decides_what_exit_restores() {
        let bounds = saved(false, Some(WINDOWED));
        assert_eq!(
            restore_after_exit(Some(&bounds), true, false),
            Restore::Bounds(WINDOWED)
        );
        // The frontend may already have left full screen; the bounds still apply.
        assert_eq!(
            restore_after_exit(Some(&bounds), false, false),
            Restore::Bounds(WINDOWED)
        );
        let maximized = saved(true, None);
        assert_eq!(restore_after_exit(Some(&maximized), true, false), Restore::Maximize);
        let unknown = saved(false, None);
        assert_eq!(restore_after_exit(Some(&unknown), true, false), Restore::DefaultSize);
        assert_eq!(restore_after_exit(Some(&unknown), false, false), Restore::Nothing);
        assert_eq!(restore_after_exit(None, true, false), Restore::Nothing);
    }

    #[test]
    fn macos_is_the_platform_that_restores_its_own_frame() {
        assert_eq!(OS_RESTORES_FRAME, cfg!(target_os = "macos"));
    }
}
