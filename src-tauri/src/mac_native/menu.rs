//! The macOS menu bar.
//!
//! Setting any menu replaces Tauri's default one, so the standard Edit items
//! are rebuilt here: without them Cmd+C/V/X/A/Z stop working in web text fields.
//! Harbor's own items are reported to the web app as `mac-native://menu`.

use serde_json::json;
use tauri::menu::{
    AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, Submenu, SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Wry};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MenuEntry {
    /// A Harbor command, handled by the web app.
    Action {
        id: &'static str,
        label: &'static str,
        accel: Option<&'static str>,
    },
    /// A system-provided item, built by `predefined()`.
    Predefined(&'static str),
    Separator,
}

/// Every kind `predefined()` can build; the tests hold the spec to this list.
#[cfg(test)]
const PREDEFINED_KINDS: &[&str] = &[
    "about",
    "services",
    "hide",
    "hide_others",
    "show_all",
    "quit",
    "undo",
    "redo",
    "cut",
    "copy",
    "paste",
    "select_all",
    "fullscreen",
    "minimize",
    "maximize",
    "close_window",
];

const fn action(id: &'static str, label: &'static str, accel: &'static str) -> MenuEntry {
    MenuEntry::Action {
        id,
        label,
        accel: Some(accel),
    }
}

pub fn menu_spec() -> Vec<(&'static str, Vec<MenuEntry>)> {
    use MenuEntry::{Predefined, Separator};
    vec![
        (
            "Harbor",
            vec![
                Predefined("about"),
                Separator,
                action("settings", "Settings…", "CmdOrCtrl+,"),
                Separator,
                Predefined("services"),
                Predefined("hide"),
                Predefined("hide_others"),
                Predefined("show_all"),
                Separator,
                Predefined("quit"),
            ],
        ),
        (
            "Edit",
            vec![
                Predefined("undo"),
                Predefined("redo"),
                Separator,
                Predefined("cut"),
                Predefined("copy"),
                Predefined("paste"),
                Predefined("select_all"),
            ],
        ),
        (
            "View",
            vec![
                action("toggle-sidebar", "Toggle Sidebar", "Ctrl+Cmd+S"),
                action("find", "Search", "CmdOrCtrl+F"),
                action("reload", "Reload", "CmdOrCtrl+R"),
                Separator,
                MenuEntry::Action {
                    id: "watch-together",
                    label: "Watch Together…",
                    accel: None,
                },
                Separator,
                Predefined("fullscreen"),
            ],
        ),
        (
            "Go",
            vec![
                action("back", "Back", "CmdOrCtrl+["),
                Separator,
                action("go-home", "Home", "CmdOrCtrl+1"),
                action("go-discover", "Discover", "CmdOrCtrl+2"),
                action("go-movies", "Movies", "CmdOrCtrl+3"),
                action("go-shows", "Shows", "CmdOrCtrl+4"),
                action("go-library", "Library", "CmdOrCtrl+5"),
                Separator,
                action("next-section", "Next Section", "CmdOrCtrl+Shift+]"),
                action("previous-section", "Previous Section", "CmdOrCtrl+Shift+["),
            ],
        ),
        (
            "Window",
            vec![
                Predefined("minimize"),
                Predefined("maximize"),
                Separator,
                Predefined("close_window"),
            ],
        ),
    ]
}

/// Ids of Harbor's own items. Menu events are app-wide (the tray menu's arrive
/// too), so only these are forwarded.
fn action_ids() -> Vec<&'static str> {
    menu_spec()
        .into_iter()
        .flat_map(|(_, entries)| entries)
        .filter_map(|entry| match entry {
            MenuEntry::Action { id, .. } => Some(id),
            _ => None,
        })
        .collect()
}

fn predefined(app: &AppHandle, kind: &str) -> tauri::Result<PredefinedMenuItem<Wry>> {
    match kind {
        "about" => {
            PredefinedMenuItem::about(app, Some("About Harbor"), Some(AboutMetadata::default()))
        }
        "services" => PredefinedMenuItem::services(app, None),
        "hide" => PredefinedMenuItem::hide(app, None),
        "hide_others" => PredefinedMenuItem::hide_others(app, None),
        "show_all" => PredefinedMenuItem::show_all(app, None),
        "quit" => PredefinedMenuItem::quit(app, None),
        "undo" => PredefinedMenuItem::undo(app, None),
        "redo" => PredefinedMenuItem::redo(app, None),
        "cut" => PredefinedMenuItem::cut(app, None),
        "copy" => PredefinedMenuItem::copy(app, None),
        "paste" => PredefinedMenuItem::paste(app, None),
        "select_all" => PredefinedMenuItem::select_all(app, None),
        "fullscreen" => PredefinedMenuItem::fullscreen(app, None),
        "minimize" => PredefinedMenuItem::minimize(app, None),
        "maximize" => PredefinedMenuItem::maximize(app, Some("Zoom")),
        "close_window" => PredefinedMenuItem::close_window(app, None),
        other => Err(tauri::Error::Anyhow(anyhow::anyhow!(
            "unknown predefined menu item {other}"
        ))),
    }
}

fn build_submenu(
    app: &AppHandle,
    title: &str,
    entries: &[MenuEntry],
) -> tauri::Result<Submenu<Wry>> {
    let mut submenu = SubmenuBuilder::new(app, title);
    for entry in entries {
        submenu = match *entry {
            MenuEntry::Separator => submenu.separator(),
            MenuEntry::Predefined(kind) => submenu.item(&predefined(app, kind)?),
            MenuEntry::Action { id, label, accel } => {
                let mut item = MenuItemBuilder::with_id(id, label);
                if let Some(accel) = accel {
                    item = item.accelerator(accel);
                }
                submenu.item(&item.build(app)?)
            }
        };
    }
    submenu.build()
}

pub fn install_menu(app: &AppHandle) -> tauri::Result<()> {
    let mut menu = MenuBuilder::new(app);
    for (title, entries) in menu_spec() {
        let submenu = build_submenu(app, title, &entries)?;
        if title == "Window" {
            // Lets macOS list open windows in it.
            submenu.set_as_windows_menu_for_nsapp()?;
        }
        menu = menu.item(&submenu);
    }
    app.set_menu(menu.build()?)?;

    let ids = action_ids();
    app.on_menu_event(move |app, event| {
        let id = event.id().as_ref();
        if !ids.contains(&id) {
            return;
        }
        if let Err(e) = app.emit("mac-native://menu", json!({ "action": id })) {
            eprintln!("[harbor::mac-native] emit menu {id} failed: {e}");
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn menu(title: &str) -> Vec<MenuEntry> {
        menu_spec()
            .into_iter()
            .find(|(name, _)| *name == title)
            .map(|(_, entries)| entries)
            .unwrap_or_default()
    }

    #[test]
    fn edit_menu_has_clipboard_items() {
        let edit = menu("Edit");
        for kind in ["undo", "redo", "cut", "copy", "paste", "select_all"] {
            assert!(edit.contains(&MenuEntry::Predefined(kind)), "Edit is missing {kind}");
        }
    }

    #[test]
    fn accelerators_unique() {
        let mut seen = std::collections::HashSet::new();
        for (_, entries) in menu_spec() {
            for entry in entries {
                if let MenuEntry::Action { accel: Some(accel), id, .. } = entry {
                    assert!(seen.insert(accel), "{id} reuses accelerator {accel}");
                }
            }
        }
        assert!(!seen.is_empty());
    }

    #[test]
    fn action_ids_are_unique_and_known_to_the_event_filter() {
        let ids = action_ids();
        let unique: std::collections::HashSet<_> = ids.iter().collect();
        assert_eq!(ids.len(), unique.len());
        for id in [
            "settings",
            "toggle-sidebar",
            "find",
            "reload",
            "watch-together",
            "back",
            "go-home",
            "go-library",
        ] {
            assert!(ids.contains(&id), "missing action {id}");
        }
    }

    #[test]
    fn every_predefined_item_is_one_the_builder_knows() {
        for (_, entries) in menu_spec() {
            for entry in entries {
                if let MenuEntry::Predefined(kind) = entry {
                    assert!(PREDEFINED_KINDS.contains(&kind), "unknown predefined item {kind}");
                }
            }
        }
    }
}
