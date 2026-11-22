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

## Apple TV-style redesign: shell, Home, title page (2026-11-17)

Design: `docs/superpowers/specs/2026-11-17-harbor-apple-tv-design.md`.

### What changed

- **No system toolbar.** A toolbar captures every click across the top of the
  window, which is what forced Harbor's own buttons onto a second row. It is
  replaced by a floating glass Back button (shown only when there is somewhere
  to go back to) and a sidebar toggle.
- **Sidebar:** full-height floating glass pane holding the traffic lights'
  zone and toggle, a search field, three groups (unlabelled, Library, More),
  and a foot with the profile and a Settings button. Clicking the profile
  opens Harbor's own account menu beside the foot.
- **Layout contract:** pages sit beside the sidebar unless they opt in with
  `data-mac-bleed` (`"absolute"` for absolutely positioned pages). An opted-in
  page marks its padded blocks with `mac-pad`. Home and the title page are
  converted; rows scroll on under the sidebar.
- **One look:** macOS pins a near-black palette, the system font and the
  full-bleed hero (`coerceMacSettings`). Harbor's theme picker has no effect on
  macOS.
- **Interface scale:** Swift reports screen points; they are divided by
  Harbor's interface scale before becoming CSS lengths. With the owner's 95%
  scale, content previously started 13 pt under the sidebar's edge.

### How it was checked

The display was locked for most of this work, and macOS refuses window
captures while locked. Two stand-ins were used:

- **Browser preview** for the web pages. Open the dev server
  (`http://localhost:1420`) in a browser, run
  `localStorage["dev.os"] = "macos"`, reload, then set
  `--mac-sidebar-inset` (269.47px at 95% scale) and `--mac-titlebar-inset` on
  `<html>`. Looked at: Home at rest and scrolled, a row scrolled sideways under
  the sidebar, the title page top and body, and an unconverted page
  (Collections).
- **Off-screen render** for the native pane and buttons:
  `SNAPSHOT_OUT=/path/out.png swift test --package-path macos/HarborNative --filter SnapshotProbe`.
  It shows arrangement only; glass draws as a flat fill.
- Startup logs of the real app after the last rebuild:
  `installed: titled=1 fullSizeContent=1 trafficLights=1`,
  `web bridge connected: controls visible=1`,
  `sidebar connected: shown=1 items=16`, no layout conflicts.
- Tests: Swift 20 (+1 opt-in), Rust `mac_native` 7, and the `mac-*` JS files.
  `pnpm test`: 8243 pass, 5 fail. The same 5 files fail on the untouched
  `beta-branch` commit (`0dc3528d`): collection-publication,
  membership-actions, membership-operations, page-collection-membership,
  stremio-history.

### Not yet seen in the real window

Most of this list was looked at later; see "Real-window check of the
redesign" below for what was seen, fixed and still open.

1. The glass itself over artwork, and legibility of sidebar text on bright art.
2. Traffic lights at their new position (22, 24) inside the pane's top zone.
3. Typing in the sidebar search field, ↓ into results, Esc; results panel
   position beside the sidebar.
4. The account menu opening from the profile row, and its position.
5. Hiding the sidebar: floating toggle appears, Back moves beside it, pages
   reflow; state survives relaunch.
6. Dragging the window by the pane's top zone and by Harbor's top bar;
   double-click to zoom.
7. The player: Harbor's top-left player controls may sit under the traffic
   lights, which are now always present.
8. Kid profile and parental lock (no account row, PIN on gated items).

### Known gaps

- Only Home and the title page are converted. Every other page is placed
  beside the sidebar and works as before.
- Poster cards still scale on hover; the design calls for calmer motion.
- Wide web dialogs are centred on the window, not on the area beside the sidebar.
- Sidebar group headings follow Harbor's language; button tooltips are English.
- From the first plan: Task 7 (side-by-side run with installed Harbor) and a
  whole-branch code review have not been done.

## Real-window check of the redesign (2026-11-17)

The screen was unlocked, so the running `pnpm tauri dev` window was captured
with `screencapture -l` and each state was looked at. States that need a click
were reached with a temporary probe module (removed afterwards, never
committed) that emitted the same `mac-native://…` events the native controls
send, or clicked a web button.

### Seen and fine

- Glass sidebar over the Home hero and the title-page backdrop; sidebar text
  stays readable on bright art.
- Home with the sidebar shown and hidden; hero text starts 41 pt after the pane.
- Title page: backdrop under the glass, Back button at the content edge.
- Search results beside the sidebar.
- Account menu opening beside the profile row.
- An unconverted page (Collections) beside the sidebar.
- The player: native sidebar and buttons leave; traffic lights stay.

### Found and fixed

- **Content under the sidebar after a cold start.** The page asked Swift for
  its layout before the page's own listener was registered, so the answer
  could be lost and both insets stayed 0. The request is now repeated once
  the listener is in place (`native-subscription.ts`, `onNativeEvent`'s
  `onReady`). Confirmed on a cold start: insets present in the first report.
- **Traffic lights sat 8 pt above the sidebar toggle.** `trafficLightPosition`
  y is now 32, which puts their centre on the toggle's line (30 pt from the
  window top) in both the shown and the hidden state.
- **Search dimming stopped at the sidebar's edge**, leaving a bright strip.
  The overlay is now padded instead of inset, so the dimming covers the page
  under the glass too.
- **Player top-left controls under the traffic lights.** Swift now reports
  where a top-left control may start (`controlsInset`, 92 pt); the windowed
  player's top row starts there (`data-player-top`, `--mac-controls-inset`).
  Measured in the real player: first control at x 92–136, lights end at 76.

- **Hero synopsis hard to read on bright artwork.** The shade behind the hero
  text is stronger and reaches across the text column; checked on a bright
  and a dark slide.

### Seen, upstream behaviour, left alone

- A hero trailer replaces the backdrop as soon as it can play, and trailers
  often open on black or on a rating card, so the hero can be black or bright
  green for a few seconds. With the window in the background the trailer
  pauses on that frame.
- Trailers in a wide format carry their own black bars, visible at the top
  and bottom of the hero while the trailer plays.

### Second pass, with real mouse and keyboard input (2026-11-17)

Input was sent to the dev window with a small CGEvent helper (kept in the
session scratchpad, not in the repo). It refuses to send anything unless the
Harbor dev app is frontmost and its main window is on screen.

Seen and fine:

- Clicking the sidebar search field focuses it and opens the results panel.
- Typing shows results; the field's clear button empties it.
- Escape closes search with the field focused; Enter opens the top match.
- Double-clicking the sidebar's top zone zooms the window and restores it.
- Fullscreen from the player hides the traffic lights; leaving brings them back.
- Parental-lock state of the sidebar, in the off-screen render only
  (`SNAPSHOT_STATE=locked`): lock marks on gated rows, no profile row.

Found and fixed:

- **Arrow keys broke the search results.** The second Down moved keyboard
  focus onto the click-away layer behind the results. Focused, that layer
  loses its absolute positioning, so the dimming vanished and focus then
  left the panel. The layer is now marked `data-tv-skip`.
- **The sidebar's top zone did not move the window.** `mouseDownCanMoveWindow`
  only works for windows movable by their background. The zone now calls
  `performDrag` itself, and a double-click follows the system title-bar
  setting (zoom, minimise or nothing). Measured: +60/+40 pt drag and back.
- **The middle third of the top bar was not a drag area** on macOS, because
  the empty search column had no height. It now fills the bar.

Not settled:

- **Dragging by the web top bar.** With synthetic input the window sometimes
  jumps so its corner lands on the pointer instead of following it. The
  installed upstream Harbor did the same on one of two tries, so this looks
  like the test input racing Tauri's asynchronous drag start, not this fork.
  Needs one try with a real mouse.

Left as it is:

- The search field keeps its text after search closes, like Harbor's own
  search; clicking the field reopens the same results.
- macOS shows its own small Siri tab beside the window while the search field
  has focus.

### Still not checked

- Kid profile and the PIN prompt in the real window: reaching them means
  creating a profile or a PIN in the owner's data.

### Third pass (2026-11-17)

- **Dragging by the web top bar**: the owner tried it with a real mouse and it
  works. The jumps seen earlier were the synthetic input.
- **The player's top row in fullscreen**: measured in the running app with a
  temporary in-page step (no mouse or keyboard input, removed afterwards).
  Windowed: padding 92/10 px, first control at x 92. Fullscreen (1470×923):
  Harbor's normal 28/16 px, first control at x 28, traffic lights hidden.
  Back to windowed: 92/10 px again. The capture itself still showed the
  loader over the row, so this is a measurement, not a look at the controls.
- Seen on the source list page: the native Back button and the page's own
  Back button are both shown. Not changed.

## More pages on the layout contract (2026-11-17)

The owner asked for the browse pages, the Library group, the More group and
then a hygiene pass, with Home's hero left as it is.

### Converted

| Page                                         | What changed                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| Movies                                       | Hero artwork under the sidebar, text and rows at the content edge               |
| Shows                                        | Rows under the sidebar; the centred showcase is unchanged                       |
| Discover                                     | Rows under the sidebar                                                          |
| Anime                                        | Break-out hero under the sidebar with its own offsets; rows inside and below it |
| My Library, Collections, Downloads, Calendar | Same content edge as the browse pages                                           |
| Catalogs, Addons                             | Same content edge                                                               |

How a page opts in: `data-mac-bleed` on the page's own root (the shell's
layers are `display: contents`, so the layer cannot be the element that
moves), and `mac-pad` on each padded block.

### Left beside the sidebar, on purpose

- **Live TV, Manga, eBook**: with nothing configured they show only their
  setup pages, so their real layouts could not be looked at.
- **Music**: it hosts native child views sized from its own box.
- **Games**: it has its own inner sidebar; two sidebars side by side is a
  design question, not a layout one.
- The collection editor, Settings, the source list.

### Other changes

- Heroes other than Home's get a stronger text shade; Home's is unchanged.
- The browser preview can be driven like the native shell: dispatch
  `mac-native://layout` and `mac-native://sidebar-select` CustomEvents on
  `window` (`registerOnPage` in `native-subscription.ts`).
- The screensaver now hides the native sidebar and buttons while it shows
  (`native-chrome-cover.ts`).
- Shared dialogs are centred beside the sidebar.

### How it was checked

Browser preview only (1280×800, the owner's data, a translucent stand-in for
the sidebar): each converted page at rest, scrolled, and with a row scrolled
sideways; no horizontal page scroll on any of them. The real window was
covered by other apps for the whole round and was **not** looked at.

### Seen and not changed

- The native sidebar stays clickable while a web dialog is open.
- The crash screen is drawn across the whole window, partly under the sidebar.
- Poster hover motion is a Harbor setting (`cardHoverStyle`, with a "none"
  option), so it was not pinned.
- On Shows the showcase's neighbouring cards are cut at the content edge
  rather than passing under the glass.

## Whole-branch code review (2026-11-17)

One fresh reviewer read `0dc3528d..HEAD`. No critical findings. It confirmed
that every new stylesheet rule is scoped to macOS, that the settings helpers
return their input on other platforms, that the C ABI copies and threads
strings safely, and that payload shapes agree across TypeScript, Rust and Swift.

### Fixed

| Finding                                                                    | Fix                                                                                                        | Proof                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| The Go menu opened pages hidden by the parental lock without a PIN         | `menuNavigation`: a page the sidebar dropped asks for the PIN when locked and is ignored for a kid profile | 4 JS tests, red then green                                              |
| Fast typing in the native field could be overwritten by its own older text | `NativeTextEcho`: text the field reported is never sent back                                               | 2 JS tests, red then green                                              |
| Sidebar, Back and Go navigated behind open search results                  | Those handlers close search first                                                                          | Seen in the preview: results close on sidebar click and on Back         |
| Clicking the highlighted sidebar row did nothing                           | A tap on the active row is reported (`rowClicked`)                                                         | Swift test, red then green; the tap itself not tried in the real window |
| After a sidebar click the arrow keys walked the sidebar                    | Keyboard focus goes back to the web view                                                                   | Swift test, red then green                                              |
| Only the screensaver hid the native chrome                                 | Profile picker, curfew lock, onboarding and Voyage launch do too (`useCoverNativeChrome`)                  | Store tests; the layers themselves not looked at                        |
| Anime's Previous arrow sat under the sidebar                               | The offset is applied through a class the arrow forwards                                                   | Measured in the preview: arrow starts at the pane's edge                |
| Find did nothing with the sidebar hidden                                   | It opens Harbor's own search whenever the view offers search                                               | Read, not exercised                                                     |

The mirror of Harbor's query to the native field now also runs once on load,
which clears a stale field after a page reload (a minor finding).

### Ruling: not fixed now

- **A packaged build would update itself to upstream Harbor.** The updater
  endpoint and key in `tauri.conf.json` are upstream's. Dev builds skip the
  updater, so nothing happens today. **Must be overridden in
  `tauri.macos.conf.json` before any packaged build is made**; if forgotten,
  the installed fork replaces itself with upstream on its first update check.
- **`data-tv-skip` on the search click-away layer applies on every platform.**
  Kept: focused, that layer collapses, and TV users close search with their
  own close control. Cost if wrong: a remote user who relied on focusing the
  backdrop to close search has to use Back instead.

### Deferred minors

- Mac settings are pinned only when settings load; the theme picker and the
  cycle-theme hotkey take effect until relaunch.
- The search hotkey is handled twice (toolbar bridge and Harbor's own).
- `topbar.tsx` imports `searchHiddenFor` from `src/chrome/mac/`.
- The kids "Play" title is English only; `--mac-titlebar-inset` is set but unused.
- No test drives the bridges themselves, and nothing ties the web sidebar
  payload to Swift's decoding; a payload Swift cannot decode is logged and ignored.

### Declined by the reviewer, still open

- Whether the `swift-rs` build dependency compiles on Windows and Linux hosts.
- How the converted pages look in the real window.

## Loading speed (2026-11-17)

The owner: loading feels slow everywhere, above all content filling in when
new rows and posters scroll into view, and it has to be "lightning fast".

### Measured in the real dev app, window in front

A temporary in-page probe (removed) scrolled a page at speed and timed each
row and poster from entering the viewport to having content.

| Page                                                       | Rows: cards after entering | Posters: image after entering                                       | Frames       |
| ---------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------- | ------------ |
| Home, artwork already cached                               | median 48 ms, max 417 ms   | median 52 ms, p90 140 ms, max 214 ms                                | about 55 fps |
| Shows, not visited before, plus two rows scrolled sideways | median 0 ms, max 404 ms    | median 528 ms, p75 883 ms, p90 1.1 s, max 2.8 s; 27 of 160 over 1 s | 60 fps       |

On the Shows run only 4 image requests appear in the page's own network
timings for 160 posters, none slower than 200 ms. So the half-second-plus wait
per poster is **not** the image download as the page sees it; it is spent
before or outside it. Not yet explained. Two leads:

- how a poster gets its image inside the real app (the browser preview loads
  artwork straight from the image host and shows it at once; the real app may
  go through Harbor's own fetch or cache path);
- per-title lookups fired while scrolling: 100 Cinemeta requests with a median
  of 4.6 s each, 175 Wikidata requests up to 9 s, 76 TMDB API requests.

A measurement taken while the window is hidden is worthless: macOS throttles
it to about one frame a second.

Both leads were tested on 2026-11-18 and neither is the cause; see the next
section.

### Cause found and fixed (2026-11-18)

**Cause.** Rows are wrapped in `content-visibility: auto` (`.harbor-row-shell`
and the `LazyMount` wrapper `.harbor-lazy-cull`). WebKit renders such content
only once it is on screen, with no margin ahead of the viewport, and until
then no IntersectionObserver or ResizeObserver inside it fires. Harbor's
look-ahead lives inside those rows (cards mount 1600px out, artwork starts
1200px out), so in the macOS web view it never ran: a poster was created a few
milliseconds before it entered the viewport and only then started to load.

**Fix.** `src/index.css` sets `content-visibility: visible` on both classes
under `html[data-os="macos"]`. The `LazyMount` wrapper's `content-visibility`
moved from an inline style to its class so that CSS can override it. Other
platforms are unchanged.

Measured with a temporary in-page probe (removed), dev app, window in front,
1600×1000 CSS px, page scrolled top to bottom at 1500 px/s, two rows scrolled
sideways. "Not cached" means Harbor's thumbnail cache was cleared first. Time
is per poster, from entering the viewport to its image being loaded.

| Page                              | Before: median / p90 / max | After: median / p90 / max | Frames before → after |
| --------------------------------- | -------------------------- | ------------------------- | --------------------- |
| Shows, artwork not cached         | 107 / 143 / 162 ms         | 0 / 0 / 258 ms            | 60 → 60 fps           |
| Shows, artwork cached             | 0 / 25 / 37 ms             | 0 / 0 / 20 ms             | 60 → 60 fps           |
| Discover, artwork not cached      | 149 / 527 / 709 ms         | 0 / 0 / 0 ms              | 58 → 58 fps           |
| Home, rows below the first screen | 127 / 267 / 484 ms         | 0 / 0 / 0 ms              | 57 → 59 fps           |

Before the fix a poster existed for a median of 8 ms before entering the
viewport; after it, about 1.1 s.

**What was ruled out.**

- _The Rust image proxy._ Loading posters straight from the image host in the
  web view was slower when not cached (median 132 ms, p90 1.5 s, 35 of 138
  over 1 s) and no faster when cached. Per image the proxy path costs a 3 ms
  cache lookup, a native fetch of about 120 ms (median 75 kB) and under 1 ms
  to decode; the time is the download, not the bridge.
- _Per-title lookups._ A Movies pass with 127 Cinemeta, 292 Wikidata and 124
  TMDB requests in flight had the same poster times as a pass with almost
  none (median 117 vs 106 ms).

**Not reproduced.** The 2026-11-17 figure for Shows (median 528 ms, 27 over
1 s) did not recur; the same page measured 107 ms before the fix. Cinemeta
answered in 4.6 s that evening against 0.4–1.7 s now, so a slow network then
is the likely difference, but that was not checked.

**Not done.** No test: the repository has no way to test a CSS rule. The
change was not timed in a production build. Other places that set
`content-visibility: auto` themselves (Collections, the Addons rail and
community list, sports league sections, the Suwayomi manga grid, episode rows
on the title page) are untouched and were not measured.

### Other numbers

- Browser preview against the dev server: Home's hero in 1.3 s, a first visit
  to a page 350–450 ms, a revisit about 50 ms.
- Dev app cold start, window to web app connected: 1.3–6.4 s.

### Production build: not made yet

`pnpm tauri build --bundles app` stalled twice in `scripts/capstan-stage.mjs`
on "fetching jdk-17.0.21+9" (an open connection to GitHub's download host, no
progress for 30 minutes). Nothing has been compared against a production
build, so how much of the slowness is the development build is unknown.

## Settings, zoom and a crash (2026-11-18)

### Crash when the sidebar hides

`NativeSidebarBridge` called a hook only while the sidebar was wanted
(`wanted && !useSyncExternalStore(...)`), so the first time the sidebar hid
the hook order changed and React threw; the app showed its error page.
Reproduced by opening Settings. The same code path runs for the player, the
stream picker and immersive mode; those were not reproduced. Introduced by
`6ec0c076`. Fixed by reading the cover state on every render. No test: nothing
in the repo renders this component.

### Heroes do not follow the interface zoom

The owner: when zooming in, the hero should stay as it is and only the other
things should grow. The zoom was at 80% when they said the hero was fine, so
that is the scale heroes are drawn at (`HERO_SCALE` in
`src/chrome/mac/native-layout.ts`; change that one number to resize them).

- `--mac-hero-zoom` is set with the interface scale and `.mac-zoom-fixed`
  applies it as CSS `zoom`, cancelling the page zoom inside the hero.
- Measured in the macOS web view: CSS zoom multiplies every length inside it,
  viewport units included, and an element's own margins and padding. So the
  hero's height uses `--mac-vh` (`HERO_FULL_HEIGHT` in
  `src/components/hero-size.ts`) and `--mac-content-start` is redefined inside
  `.mac-zoom-fixed`; both divide by the zoom again.
- The class goes on an element with no margins of its own that depend on the
  page's scale. On Anime it is on the hero's text block only, because that
  hero also carries a row of posters, which has to follow the zoom.
- Applied to: Home and Library (`HeroCarousel`), Movies (`CinemaHero`), Shows
  (`PeekHero`), Discover (`FeaturedBanner`), Anime (`AnimeHero` text block).

Checked in the real window at 80%, 100%, 120% and 130%:

| Page   | Hero at 80%   | Hero at 120–130% | Text start vs. row heading |
| ------ | ------------- | ---------------- | -------------------------- |
| Home   | 1464 × 720 pt | 1460 × 720 pt    | equal at every scale       |
| Movies | 1464 × 720 pt | 1461 × 720 pt    | equal                      |

Shows, Discover and Anime were looked at at 120%. Known limits: text inside a
hero still grows by about 3–5% across the range (font-size rounding); the
Discover banner is 16 pt taller at 120% than at 80%; the Anime and Manga
skeletons and the Manga hero are not fixed; breakpoints inside a hero still
follow the zoomed viewport width.

### Settings

The owner asked for a rebuilt Settings page with a MacBook feel, consistent
with the rest.

- While Settings is on screen the native sidebar lists the settings pages
  (32, in 10 groups) instead of Harbor's navigation. No Swift change: the
  sidebar already takes any list. `src/views/settings/mac-settings-chrome.tsx`
  publishes the pages, `src/chrome/mac/settings-sidebar.ts` holds the model,
  the SF Symbol for each page and the store, and `NativeSidebarBridge` shows
  them and routes `settings-page:<id>` clicks back. `sidebarVisible` no longer
  hides the sidebar in Settings.
- The page's own rail is hidden; a page's tabs are a strip above its content
  (`MacSettingsTabs`), fed by what the panel registers through `useSubTabs`.
- Search is a field on the title line. Its results are still rendered by the
  rail component, shown as a panel beneath the field.
- Look: the block at the end of `src/index.css` ("Settings on macOS"). It
  overrides the shell's `--hset-*` variables and restyles the shared hooks
  (`.harbor-settings-group` as a card, `.hset-row`, `.harbor-settings-label`,
  switches, segmented controls, buttons in a row's control column). Three
  hooks were added for it: `hset-toggle`, `hset-toggle-knob`,
  `hset-segmented`.
- The grouping of pages (`settingsBands`, `BAND_LABELS`) moved from the rail
  component to `src/views/settings/groups.ts` so both sidebars share it.

Seen in the real window: Account, Trackers, Get started, Player & quality,
Subtitles, Streaming sources, Library & metadata, Theme & appearance, Hotkeys,
Storage, Advanced, the search panel, and Back returning to Shows with the
normal sidebar. Not looked at: the other 21 pages; panels that draw their own
controls with utility classes keep Harbor's larger buttons and fields; nothing
was removed, so TV, Big Picture, remotes and updates are still listed.

### How it was looked at without taking the window to the front

A temporary module imported from `src/main.tsx` emitted the native events
(`mac-native://menu`, `mac-native://sidebar-select`) and
`screencapture -x -o -l <window id>` captured the window while another app was
in front. Zoom was stepped by dispatching ⌘= / ⌘- key events and stepped back
afterwards; that goes through the owner's saved setting, so check it is
restored. A second browser (the preview) also loads such a module; guard it
with `"__TAURI_INTERNALS__" in window`.

## Scrollbars and motion (2026-11-18)

Not committed and not yet seen: the screen was locked for the whole of this
work, so everything below was measured inside the running dev window, never
looked at.

- **Scrollbars.** Any `::-webkit-scrollbar` rule makes WebKit draw its own bar,
  always visible and 8px out of the page. On macOS every element now gets
  `scrollbar-width: thin` from the base layer with no specificity, which brings
  back the system bar that floats and shows only while scrolling, and leaves
  every `scrollbar-width: none` in the app working. Home's scroller: 7px taken
  before, 0 after.
- **Page changes.** `mac-view-in` (260ms fade with an 8px rise) on
  `.harbor-layer-active > *`. Confirmed running on Movies, Shows, Discover,
  Library, Anime, Settings, Home, a title page and Back. None of those pages had
  fixed-position content, which a transform would misplace while it runs.
- **Settings tabs.** `useMacTabEnter` replays a 220ms rise when the tab changes;
  page changes already used `harbor-cascade`.
- **Scrolling.** Stepping Home, Movies and Shows at 1800px/s held 60fps with at
  most one frame over 50ms per pass once rows had loaded; Home's first pass had
  six (55–77ms) as rows mounted. Harbor's own "smooth scrolling" option is off
  and nothing else takes over the trackpad. What the owner meant by "smooth
  scrolling is not there" is not established.
- Screen lock can be read before trying a capture:
  `ioreg -n Root -d1 -a | grep -A1 CGSSessionScreenIsLocked`.

## One page layout, a shorter sidebar, defects and a release build (2026-11-20)

Asked for after a walk of 16 pages; the owner chose compact titles, hiding
Music, Games, Manga and eBook, and "personal now, GitHub later".

- **Page template** (`mac-page-*` hooks, "Page template on macOS" in
  `src/index.css`): Library, Collections, Calendar, Downloads, Catalogs, Addons
  and the Live TV start page share one title (26px/700, level with Settings),
  one left edge and 30px header controls. Seen in the dev window.
- **Sidebar trim**: `coerceMacSettings` hides `MAC_NAV_TRIM` once
  (`_macNavTrimV1` travels with the saved settings). Settings › Get started ›
  Sidebar (`mac-sidebar-section.tsx`) turns each back on; the native sidebar has
  no context menu, so that section is the only way. Trim seen; the section not.
- **Defects**, coded but not looked at unless marked:
  - hero trailers skip a 7s lead-in (ratings card) and are scaled to 135% to
    lose baked-in letterbox bars;
  - Discover's side panel no longer pads its grid with one image four times;
  - Library's own tab has its own empty-state text;
  - native sidebar: a section and a row shared the id `library`, so selecting
    My Library highlighted the heading too; rows now fade above the footer
    (Swift, compiles, not seen running);
  - Calendar's type badge shows only when the day is 200px wide (container
    query), so titles are no longer squeezed to two letters;
  - Addons' featured card has a wider text scrim; Anime's right-hand details
    clear the next arrow and the "Tune anime" tab sits inside the window;
  - a fade under the titlebar (`.mac-stage::before`) for content scrolling up;
  - a page's Customize button rides on its hero's corner on Movies.
    Not done: the carousel arrow that sits on the last Addons card, and the Back
    button that Downloads shows and Collections does not.
- **Release build**: `sh scripts/mac-build.sh`. Three things blocked it:
  the extension layer's jars were stale (`sh android-extension-compat/tools/deps.sh`),
  `pkgconf` was not installed, and the libmpv staging refuses Homebrew's mpv
  because it targets this macOS only (lifted for local builds with
  `HARBOR_MACOS_MINIMUM_CEILING`). The bundler also stops on read-only files
  (Homebrew-linked ffmpeg, the Java runtime); the script makes writable copies.
  Staging rewrites `src-tauri/binaries/mpv-<target>`, which breaks
  `pnpm tauri dev` and `tests/subtitle-native-mpv.test.ts`; the script relinks
  it to the installed mpv when it finishes. Built, signed with the owner's
  Apple Development certificate, verified with `codesign --verify --deep
  --strict`, installed as `/Applications/Harbor Mac.app` (the upstream
  `Harbor.app` is untouched) and launched; the screen locked before its window
  could be captured, so it has not been looked at. The long-running
  `pnpm tauri dev` died during this work and was not restarted.
- Captures of a window on another desktop come back with an empty page (only
  the native sidebar is drawn). Check `kCGWindowIsOnscreen` before trusting one.

## Faster and lighter (2026-11-22 to 23)

The owner: "make this app faster and lighter maximum in whatever way possible
without any sort of compromise". Asked which sections may go, they chose all
four offered (Games, Music, Manga and ebooks, extra themes) and to show Home
as soon as it is drawn instead of after the fixed logo hold.

### Numbers

Release builds made with `scripts/mac-build.sh`, same Mac, same account data,
warm launches, window 1280×800, three launches of each taken in turn. "Before"
is the build of `cfe396a6`, "after" the build of `72f65473`.

| What                                          | Before        | After       |
| --------------------------------------------- | ------------- | ----------- |
| App bundle                                    | 399 MB        | 274 MB      |
| Main binary                                   | 225 MB        | 100 MB      |
| of which code / embedded frontend / link data | 45 / 152 / 26 | 20 / 73 / 7 |
| Built frontend (`dist`)                       | 282 MB        | 150 MB      |
| Script evaluated before anything can draw     | 11.1 MB       | 4.5 MB      |
| Launch to window on screen                    | 0.62–0.64 s   | 0.58–0.63 s |
| Launch to Home drawn                          | 2.47–2.59 s   | 0.81–0.85 s |
| Memory 14 s after launch, app process         | 258–262 MB    | 109–110 MB  |
| Memory 14 s after launch, web content process | 480–487 MB    | 390–417 MB  |
| Memory 14 s after launch, all four processes  | 829–844 MB    | 594–624 MB  |

Launch times are from `open` to the first captured frame of the window whose
rows area is painted (`launch2.sh` and `painted.py`, below). Memory is
`footprint -p` for the app and the three WebKit processes that appeared with
it. Idle CPU on Home did not change (about 2.5% app, 4% web content, 4.5% GPU,
with the hero playing).

In WebKit against the built files, with the network answered empty (a guest,
so the page is the setup screen): first render 254 ms → 184 ms, page revealed
2005 ms → 244 ms.

### What was done

- **The Mac edition** (`b9f0bd73`, corrected in `72f65473`).
  A build made on a Mac leaves out Games, Music, Manga, Ebooks and the extra
  themes: `HARBOR_EDITION` in `vite.config.ts`, the constants in
  `src/lib/features/edition.ts`, and `--no-default-features --features plugins`
  for Cargo from `scripts/tauri.mjs`. `HARBOR_EDITION=full` builds everything.
- **Launch script** (`b16e6340`): the awards table, hls.js and mpegts.js, the
  whole lucide icon set, lottie-web, the small windows' apps and the controller
  drawing no longer load before the first screen.
- **Remote font stylesheets** (`69f3b2f6`) are added after the page has loaded.
- **Launch reveal** (`414ffda6`, `fec2ebc2`): on macOS the splash lifts when the
  first screen's pictures are in, and the page asks for the window as its
  script starts.
- **yt-dlp verification** (`3f3c7319`): the cause of the app process's size.
  Every trailer lookup read the 36 MB single file into memory and hashed it,
  then hashed the 124 MB unpacked folder: about 0.5 s per lookup, several at
  once at launch. A `sample` of the first five seconds showed 1.1 s of SHA-256;
  `vmmap --summary` showed 163 MB dirty in "Malloc Large (empty)". An unchanged
  copy is now verified once per launch.
- **Release profile** (`3bc3a468`): fat LTO, one codegen unit. The build takes
  about 7 minutes from a warm cache.

### Found, not changed

- 47 MB of what remains in the frontend is the player's X-Ray face models
  (MediaPipe, ONNX runtime, the recogniser). 60 MB of the bundle is the Java
  runtime stream plugins run on. Both belong to features that were kept.
- About 100 kB of Music and Manga code is still reached from kept features
  (Listen Together, Song ID, the soundtrack row, context menus), and Settings ›
  Account still shows "Profile songs".
- The stylesheet is 1.3 MB, half of it Tailwind utilities. Telling Tailwind to
  skip the left-out sections saved 2.5% and was dropped.
- `public/anime-hero-art.json` (3.3 MB) is still fetched and parsed 1.5 s after
  launch, on every launch.

### How it was measured

Scripts are in this session's scratchpad
(`/private/tmp/claude-501/-Users-pratyush-Developer-stremio-better/c4fda875-f044-4718-abc3-9e1b5db96a09/scratchpad/`),
which may be cleared:

- `vite.analyze.config.ts` (copy it to the repo root to use it) with
  `build-an.sh <out dir> <chunks.json>`: builds into the scratchpad and dumps
  every chunk's modules and the import graph. `an.mjs` (what the launch script
  is made of), `an2.mjs <regex>`, `why.mjs <regex>` (shortest import chain from
  `src/main.tsx`), `who.mjs <regex>` (kept modules that use a left-out one),
  `roots.mjs` (kept modules that still load a left-out lazy chunk).
- `boot.mjs <dist> [runs]`: start timings in WebKit. `walk.mjs <dist>`: every
  sidebar page, Settings and a title page as a guest, with page errors and
  missing files. **Run the walk on any change to what the build leaves out**:
  the first version of the pruning step deleted the stylesheets of every lazily
  loaded page, Home looked right, and only the walk showed it.
- `launch2.sh <name> <app> <process path fragment> [capture s] [settle s]`:
  launches an app, captures frames, then prints memory and CPU and quits it.
