# Mac fork baseline and verification log

Running notes for the native macOS fork. Each workstream task appends what was
checked and what was found.

## Task 1 — toolchain and baseline (2026-11-17)

### Toolchain on this Mac

| Tool             | Version               | How it got here                                                 |
| ---------------- | --------------------- | --------------------------------------------------------------- |
| macOS            | 27.0.1, Apple Silicon |                                                                 |
| Xcode / Swift    | 27.2 / 6.4.2          | already installed                                               |
| Node             | 22.22.1 (nvm)         | already installed                                               |
| Rust             | 1.100.0 stable        | `rustup`                                                        |
| pnpm             | 11.9.0                | `corepack prepare pnpm@11.9.0 --activate`                       |
| mpv / libmpv     | 0.42.0                | `brew install mpv`                                              |
| ffmpeg / ffprobe | 9.0.2                 | came with mpv from Homebrew                                     |
| cmake            | 4.5.0                 | `brew install cmake` (needed by `leveldb-sys`; not in the plan) |

### Setup scripts

- `pnpm install`: ok.
- `pnpm run setup:fonts`: ok.
- `pnpm run setup:binaries`: **did not work as shipped.** Its Node download of
  yt-dlp stalled for 10 minutes, and for macOS it fetches x86_64 ffmpeg/ffprobe
  from evermeet.cx, which need Rosetta. Rosetta is not installed here.
  What is in `src-tauri/binaries/` instead (the folder is gitignored):
  - `yt-dlp-aarch64-apple-darwin`: the official universal binary, fetched with `curl`.
  - `ffmpeg-aarch64-apple-darwin`, `ffprobe-aarch64-apple-darwin`: symlinks to
    `/opt/homebrew/bin/ffmpeg` and `ffprobe` (native arm64).
    These Homebrew builds link Homebrew libraries by absolute path, so an app
    bundle built from them only runs on a Mac with the same Homebrew ffmpeg.
    That is fine for a personal build and must be revisited before sharing the app.
- `pnpm run setup:capstan` (Android extension layer): timed out downloading
  `dex-tools-v2.4.zip` on a slow connection. Not needed to run the app; dev
  prints "extensions are off in this dev session".

### Upstream build break

`beta-branch` @ `0dc3528d` does not compile on macOS:
`src-tauri/src/games/native_package.rs:5` uses `PathBuf` in a signature while
importing it inside the function body (E0425). Fixed in its own commit.

### Baseline run

- `pnpm tauri dev` builds (900 crates) and launches.
- The fork's data folder `~/Library/Application Support/app.harbor.mac` was
  created on first launch, next to installed Harbor's `app.harbor`.
- Window before any change: one borderless 1280×800 window with no system
  title bar (Harbor draws its own chrome).
- No screenshot: `screencapture` is refused from this terminal (no Screen
  Recording permission), so the window was only inspected through the window list.
- **Not checked yet:** playing a stream. That needs a signed-in profile with
  addons, which the fresh `app.harbor.mac` profile does not have.
- Pre-existing Rust warnings on macOS (not from this fork): 12, of which 7 are
  `NSOpenGL*` deprecations in `mpv_render_mac.rs`, 2 `fetch_update`
  deprecations, 1 unnecessary `unsafe`, 1 unreachable expression. One more
  (unused `PathBuf` import) went away with the build fix.

### Data carry-over

Export a backup from installed Harbor (Settings → backup, `src/lib/backup.ts`
`downloadBackup`) and restore it in the fork. No import code is written.

## Task 3 — system window frame (2026-11-17)

### Checked by the build and the running app

- Startup log from the Swift side: `[HarborNative] installed: titled=1 fullSizeContent=1 trafficLights=1`.
  The window has the system frame, real close/minimize/zoom buttons, and web
  content extending under a clear title bar.
- Tests: `tests/mac-chrome.test.ts` (5), Swift `WindowFrameTests` (2).
- `pnpm run typecheck` and `cargo check` clean (same 34 pre-existing Rust warnings).
- `pnpm run check` cannot run as written: `vp` (Vite+) is a global tool that CI
  installs separately. The CI gate was reproduced with
  `pnpm --package=vite-plus@1.5.1 dlx vp fmt --check` and `vp check --no-fmt`
  on the changed files; both pass.

### Decisions that differ from the plan

- `transparent` stays `false` in `tauri.macos.conf.json`. Tauri's `transparent: true`
  needs the `macos-private-api` feature; upstream already makes the window and
  webview see-through by hand in `mpv_render_mac.rs`, and that code is kept.
- Harbor's "Borderless window" fullscreen mode is not offered on macOS and
  resolves to true full screen. It works by removing window decorations, which
  would drop the system frame.
- The mpv video window's corner radius went from 14 to 16 pt to match the
  system frame's corners. This number is an estimate and needs an eye on it (item 6).

### Still to check by hand

Nobody has looked at the window yet: this terminal has no Screen Recording or
Accessibility permission. With `pnpm tauri dev` running:

1. Traffic lights at top-left; no HTML window buttons or dots anywhere.
2. Double-click the title-bar area: zooms or minimizes per System Settings.
3. Double-click the right window edge: that edge stretches to the screen edge.
4. Drag to a screen corner or use the tiling menu: the window snaps.
5. ⌃⌘F enters full screen and exiting keeps the frame. Same via the player's
   fullscreen button.
6. Play a stream: video visible, correctly placed and sized, also after
   resizing and in full screen. Look at the four window corners for slivers
   of video or desktop.
7. Quit and relaunch: same size, frame intact.

Known interim state until Tasks 4 and 5: the React sidebar's top-left content
sits under the traffic lights.

## Task 4 — Liquid Glass toolbar (2026-11-17)

### Checked by the build and the running app

- Startup logs: `installed: … toolbarItems=4` and
  `web bridge connected: toolbar visible=1 titlebarInset=52`. The toolbar exists,
  the web app reaches Swift through Rust, and Swift reports a 52 pt inset back.
- Tests: Swift `ToolbarTests` (7) and `PayloadsTests` (3), `tests/mac-native-toolbar.test.ts` (6).

### Decisions that differ from the plan

- Leaving the search field does not close search. The plan closed it when the
  field lost focus with empty text, but clicking a recent search also takes focus
  from the field, and the close would race the click. Search closes with Escape
  or by clicking outside the results.
- The search field is hidden on the views where Harbor already hid its search
  pill (Music, Games, Addons, Settings, pickers, kid profiles), so behaviour there
  is unchanged.
- The web Back button in the top bar is not shown on macOS; the toolbar's Back
  replaces it. The Live TV root keeps its own back-to-Home button.
- The web content area is pushed down by the toolbar height (a top margin), so
  content does not scroll underneath the toolbar. The plan asked for this inset;
  it means the toolbar sits over the app background, not over posters.
- Arrow down in the search field moves keyboard focus into the web results;
  from there the arrow keys and Return work as they do in the web UI. Arrow up
  does not return to the field (click it or press the search hotkey).
- Toolbar item labels and tooltips are English only.

### Still to check by hand

1. Glass toolbar with sidebar toggle, Back and a search field.
2. Typing shows results live; ↓ moves into results; Return opens the top or
   focused result; Esc closes.
3. Back is disabled on Home and works after opening a title.
4. During playback the toolbar is hidden and the traffic lights still work.
5. The search hotkey focuses the native field.
6. Double-clicking an empty part of the toolbar zooms the window.
7. The web top bar's remaining buttons (downloads, notifications, bookmarks,
   Together) sit just below the toolbar and are clickable.
8. Legibility of the toolbar over the app background in each theme you use.

## Task 5 — floating Liquid Glass sidebar (2026-11-17)

### Checked by the build and the running app

- Startup log: `sidebar connected: shown=1 items=17`, with no Auto Layout
  conflicts logged. The glass pane is in the window and received Harbor's
  navigation items.
- Tests: Swift `SidebarTests` (4), `tests/mac-native-sidebar.test.ts` (8).

### Not done: content under the glass

The plan asked for Home rails and the hero backdrop to extend under the
sidebar so posters refract through it. That is **not built**. The web content
area starts to the right of the sidebar, as it did beside the React sidebar,
so the glass currently sits over the app background.

Reason: Harbor has 87 separate scrolling views, each with its own padding, and
extending them under the pane needs per-view layout work that cannot be judged
without looking at the result. It belongs with workstream 3 (scroll and motion).

### Decisions that differ from the plan

- The account menu moved to the top bar on macOS. The plan said the top bar
  already had an account button; in this layout it does not, and the profile
  chip at the sidebar foot was the only way to switch profile or sign out.
- The sidebar highlight uses the system's list selection, driven by the web
  app's active view. Clicking a row reports the click and the highlight moves
  only when the web app confirms, so a refused PIN leaves it where it was.

### Dropped from the React sidebar on macOS

Brand wordmark, right-click navigation menu, hidden-tabs tray, Big Picture
entry, and the collapsed icon rail (collapsing now hides the sidebar; the
toolbar button brings it back). Navigation editing is still in Settings.

### Still to check by hand

1. Floating glass sidebar with SF Symbol icons, no hover animations.
2. Each item navigates and the highlight follows, also after Back or a search result.
3. With parental lock on, a gated item asks for the PIN and only then routes;
   Cancel changes nothing.
4. Kid profile, renaming or hiding a tab in Settings, and changing the UI
   language each update the sidebar at once.
5. The toolbar's sidebar button hides and shows it and the content follows;
   the state survives relaunch.
6. Hidden in Settings, the player, the stream picker and immersive mode.
7. The account menu in the top bar opens, switches profile, and opens Settings.

## Task 6 — native app menu (2026-11-17)

- Menu bar: Harbor, Edit, View, Go, Window, as listed in the plan. It installs
  without error at startup (no `menu install failed` in the log).
- Tests: Rust `mac_native::menu` (4), `tests/mac-native-menu.test.ts` (3).
- Hotkey clashes: none with Harbor's defaults. Every default binding in
  `src/lib/hotkeys.ts` is a plain key or uses Control; none uses ⌘. A binding
  you set yourself to ⌘, ⌘F ⌘[ ⌘1–5 or ⌃⌘S would lose to the menu.
- Menu commands are ignored while the player is up, so a stray ⌘1 cannot
  change the page underneath a playing video.

### Still to check by hand

1. ⌘A, ⌘C, ⌘X, ⌘V and ⌘Z in a web text field; typing letters is never swallowed.
2. Each Go item and ⌘[ navigates; ⌘, opens Settings; ⌘F focuses search; ⌃⌘S
   toggles the sidebar.

## Direction change (2026-11-17)

After seeing the running app, the owner asked for the look to be rebuilt after
the Apple TV app on macOS, keeping all of Harbor's features. Tasks 1–6 are
committed; Task 7 (side-by-side run, backup restore, sign-off) and the final
code review were not run. The window frame, Rust⇄Swift bridge, menu and
navigation plumbing carry over; the toolbar and sidebar layout will be redone.
