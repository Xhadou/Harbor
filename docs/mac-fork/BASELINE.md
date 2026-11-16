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
