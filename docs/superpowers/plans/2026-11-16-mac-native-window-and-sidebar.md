# Mac Native Window, Toolbar, Glass Sidebar and Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harbor on macOS runs in a real system window with traffic lights, a Liquid Glass toolbar holding Back, a sidebar toggle and a native search field, a floating native Liquid Glass sidebar replacing the React sidebar, and a proper macOS menu bar.

**Architecture:** Tauri stays the host. A Swift package (`macos/HarborNative`, static library) owns all AppKit/SwiftUI UI and is linked into the Tauri binary by `build.rs`. Rust and Swift talk through a small hand-written C ABI (`@_cdecl` functions; JSON strings for structured payloads; one Swift→Rust callback). Rust re-emits Swift events to the web app as Tauri events `mac-native://<kind>` and exposes Tauri commands the web app calls to push state into Swift. React components under `src/chrome/mac/` bridge Harbor's existing state (view stack, sidebar navigation, search) to those commands and events.

**Tech Stack:** Tauri 2.12, Rust (objc2 0.6, objc2-app-kit 0.3, swift-rs build helper), Swift 6.4 / SwiftUI / AppKit on the macOS 26+ SDK (`NSGlassEffectView`, `NSToolbar`, `NSSearchToolbarItem`), React 19 + TypeScript, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-16-harbor-mac-native-design.md` — this plan implements **workstream 1** only.

## Global Constraints

- Minimum macOS **26.0** (Liquid Glass APIs). Package.swift platform and `bundle.macOS.minimumSystemVersion` both say `26.0`.
- Bundle identifier for the fork: **`app.harbor.mac`** (distinct from installed Harbor's `app.harbor`). `productName` stays `Harbor`.
- Liquid Glass only from `NSGlassEffectView` / SwiftUI `glassEffect`. **No CSS-faked glass** (`backdrop-filter` + gradients posing as glass) in any new web code.
- No HTML imitations of native controls on macOS: no HTML traffic lights (`MacDots`), window buttons, resize edges, menu bar, or search field where the native one exists.
- Every macOS-only code path is isolated: Rust behind `#[cfg(target_os = "macos")]`, TS behind `isMacDesktop()` from `src/lib/platform.ts`. Non-mac builds need not keep compiling (spec non-goal), but do not break them gratuitously.
- Repo rules (`AGENTS.md`): after TS changes run `pnpm run check` and `pnpm run typecheck` (**never `tsc -b`**); after Rust changes run `cargo check --manifest-path src-tauri/Cargo.toml`. Leave no new warnings.
- Single navigation layout on macOS: the left sidebar. Alternative layouts (`dracula`, `nord`, `forest`, `stremio`, `midnight`, `topdock`, `cinematic`, `royal`, `rail`, `minui`, `custom`) are not rendered on macOS.
- Motion in new native UI: system defaults only; no custom springs, bounces, or hover animations.

## Review Focus

1. **Video during mpv playback under the native frame.** Expect video to remain visible and correctly positioned (mpv draws in a child window _below_ the main window, so the main window must stay non-opaque with a clear background, and CSS→screen geometry must still line up now that the content view extends under the title bar). Pinned by Task 3 Step 7.
2. **Text editing in web inputs with a custom menu bar.** Expect ⌘C/⌘V/⌘X/⌘A/⌘Z to work in web text fields (settings, addon URL, search overlay), and menu accelerators not to swallow typing. A custom Tauri menu replaces the default one, so the Edit menu must be rebuilt. Pinned by Task 6 Steps 1 and 6.
3. **Parental lock via the native sidebar.** Expect a gated item to open the PIN modal and never route directly. Pinned by Task 5 Step 1 (`gated` carried through) and Step 7.
4. **Profile/kid/locale changes.** Expect the native sidebar's items and labels to update immediately when the profile, kid mode, nav customization, or UI language changes. Pinned by Task 5 Step 1 (pure mapping uses `t`) and Step 7.
5. **Full screen and relaunch.** Expect entering/exiting full screen (native ⌃⌘F and Harbor's own fullscreen paths in `src/lib/fullscreen-state.ts`) to leave the system frame on, and the window to reopen at its saved size with the frame intact. Pinned by Task 3 Steps 1 and 7.

---

### Task 1: Toolchain, fork identity, and a running baseline

**Files:**

- Create: `src-tauri/tauri.macos.conf.json`
- Modify: `.gitignore` (append `macos/HarborNative/.build/`)
- Create: `docs/mac-fork/BASELINE.md`

**Interfaces:**

- Produces: a working `pnpm tauri dev` on this Mac; `tauri.macos.conf.json` that later tasks extend.

- [ ] **Step 1: Install toolchain**

Run:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
corepack enable && corepack prepare pnpm@11.9.0 --activate
brew install mpv
```

Expected: `rustc --version`, `pnpm --version` (11.9.0), `ls /opt/homebrew/lib/libmpv.dylib` all succeed.

- [ ] **Step 2: Install deps and fetch sidecars**

Run: `pnpm install && pnpm run setup:binaries && pnpm run setup:fonts && pnpm run setup:capstan`
Expected: exits 0; `src-tauri/binaries/` contains `yt-dlp-*`, `ffmpeg-*`, `ffprobe-*` for `aarch64-apple-darwin`. If a `setup:*` script is Windows-only and fails, record it in BASELINE.md and continue if `pnpm tauri dev` still starts.

- [ ] **Step 3: Create `src-tauri/tauri.macos.conf.json`**

```json
{
  "identifier": "app.harbor.mac",
  "bundle": { "macOS": { "minimumSystemVersion": "26.0" } }
}
```

(Tauri merges `tauri.macos.conf.json` over `tauri.conf.json` on macOS. Task 3 adds the window keys.)

- [ ] **Step 4: Baseline run**

Run: `pnpm tauri dev`
Expected: Harbor opens with its current borderless chrome; data lives under `~/Library/Application Support/app.harbor.mac` (verify the folder appears). Play any stream to confirm mpv works.

- [ ] **Step 5: Record baseline**

Write `docs/mac-fork/BASELINE.md`: toolchain versions, any setup script that failed, and a screenshot path or note of the current window. Also record: "Data carry-over: export a backup from installed Harbor (Settings → backup, `src/lib/backup.ts` `downloadBackup`) and restore it in the fork. No import code is written." (This replaces the spec's first-launch import offer with Harbor's existing backup feature.)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/tauri.macos.conf.json .gitignore docs/mac-fork/BASELINE.md
git commit -m "chore(mac): fork identity app.harbor.mac, macOS 26 floor, baseline notes"
```

---

### Task 2: Swift package and Rust⇄Swift bridge

**Files:**

- Create: `macos/HarborNative/Package.swift`
- Create: `macos/HarborNative/Sources/HarborNative/Bridge.swift` (C ABI entry points + callback)
- Create: `macos/HarborNative/Sources/HarborNative/Payloads.swift` (Codable payload types)
- Create: `macos/HarborNative/Tests/HarborNativeTests/PayloadsTests.swift`
- Create: `src-tauri/src/mac_native/mod.rs` (extern decls, install, Tauri commands, event forwarding)
- Modify: `src-tauri/Cargo.toml` (build-dependency `swift-rs = { version = "1", features = ["build"] }`)
- Modify: `src-tauri/build.rs` (macOS branch: link the Swift package)
- Modify: `src-tauri/src/lib.rs` (declare `mod mac_native`, call install in the existing macOS setup block near line 1170, register commands)

**Interfaces:**

- Produces (C ABI, Swift `@_cdecl`, all called on the main thread only):
  - `harbor_native_abi_version() -> Int32` → returns `1`
  - `harbor_native_install(nsWindow: UnsafeMutableRawPointer, callback: @convention(c) (UnsafePointer<CChar>, UnsafePointer<CChar>) -> Void)` — `callback(kind, json)`
  - `harbor_native_sidebar_set(json: UnsafePointer<CChar>)`
  - `harbor_native_toolbar_set(json: UnsafePointer<CChar>)`
  - `harbor_native_search_set(json: UnsafePointer<CChar>)`
- Produces (Rust, `src-tauri/src/mac_native/mod.rs`):
  - `pub fn install(app: &tauri::AppHandle, ns_window: *mut c_void)`
  - Tauri commands `mac_native_sidebar_set(app, payload: String)`, `mac_native_toolbar_set(app, payload: String)`, `mac_native_search_set(app, payload: String)` — each hops to the main thread via `app.run_on_main_thread` and calls the matching Swift function.
  - Every Swift callback is emitted to the web as Tauri event `"mac-native://" + kind` with the JSON parsed into `serde_json::Value`.
- Produces (Swift payload types, `Payloads.swift`, `Codable`, camelCase JSON):
  - `SidebarPayload { visible: Bool; collapsed: Bool; items: [SidebarItem] }`
  - `SidebarItem { id: String; title: String; symbol: String; section: String /* "primary" | "collections" */; active: Bool; gated: Bool; badge: Int? }`
  - `ToolbarPayload { visible: Bool; canGoBack: Bool }`
  - `SearchPayload { text: String; focused: Bool }`
- Event kinds (Swift → web), the full set used by Tasks 4–5:
  `sidebar-select {id}`, `toolbar-back {}`, `toolbar-toggle-sidebar {}`, `search-text {text}`, `search-begin {}`, `search-end {}`, `search-key {key: "ArrowUp"|"ArrowDown"|"Enter"|"Escape"}`, `layout {titlebarInset: Double, sidebarWidth: Double, sidebarVisible: Bool}`

- [ ] **Step 1: Write the failing Swift test**

`PayloadsTests.swift`:

- `testSidebarPayloadDecodes`: decoding `{"visible":true,"collapsed":false,"items":[{"id":"home","title":"Home","symbol":"house","section":"primary","active":true,"gated":false}]}` yields one item with `id == "home"`, `badge == nil`, `active == true`.
- `testUnknownSymbolFallsBack`: `SidebarItem.resolvedSymbol(for: "not.a.real.symbol")` returns `"circle"`; for `"house"` returns `"house"` (uses `NSImage(systemSymbolName:accessibilityDescription:) != nil`).

- [ ] **Step 2: Run to verify it fails**

Run: `swift test --package-path macos/HarborNative`
Expected: FAIL (package/types missing).

- [ ] **Step 3: Create the package and payloads**

`Package.swift`: swift-tools-version 6.2, `platforms: [.macOS("26.0")]`, one library product `HarborNative` with `type: .static`, one target, one test target. Implement `Payloads.swift` types above plus `static func resolvedSymbol(for:) -> String`.

- [ ] **Step 4: Run Swift tests**

Run: `swift test --package-path macos/HarborNative`
Expected: PASS.

- [ ] **Step 5: Write the failing Rust link test**

In `src-tauri/src/mac_native/mod.rs`:

```rust
#[cfg(all(test, target_os = "macos"))]
mod tests {
    #[test]
    fn swift_library_links() {
        assert_eq!(unsafe { super::harbor_native_abi_version() }, 1);
    }
}
```

- [ ] **Step 6: Run to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml mac_native::tests::swift_library_links`
Expected: FAIL to link/compile (`harbor_native_abi_version` undefined).

- [ ] **Step 7: Implement `Bridge.swift`, the build link, and `mac_native/mod.rs`**

- `Bridge.swift`: the five `@_cdecl` functions. `harbor_native_install` stores the callback and the `NSWindow`, and creates a `HarborNativeController` (empty for now; Tasks 3–5 fill it). The setters decode payloads and forward them to the controller; a decode failure logs via `NSLog` and is ignored. A helper `emit(kind: String, payload: Encodable)` encodes JSON and invokes the callback.
- `build.rs` (macOS branch only): `swift_rs::SwiftLinker::new("26.0").with_package("HarborNative", "../macos/HarborNative").link();` and `println!("cargo:rerun-if-changed=../macos/HarborNative/Sources")`.
- `mod.rs`: `extern "C"` declarations matching the C ABI; `install` stores the `AppHandle` in a `OnceLock` used by the `extern "C" fn on_native_event(kind, json)` callback, which emits the Tauri event; the three commands. Register the commands in `lib.rs`'s `invoke_handler`, and call `mac_native::install(&handle, ns_window)` inside the existing `#[cfg(target_os = "macos")]` setup block, after `window.ns_window()`.

- [ ] **Step 8: Verify**

Run: `cargo test --manifest-path src-tauri/Cargo.toml mac_native::tests::swift_library_links` → PASS.
Run: `cargo check --manifest-path src-tauri/Cargo.toml` → no new warnings.
Run: `pnpm tauri dev` → app launches exactly as before (the controller does nothing yet).

- [ ] **Step 9: Commit**

```bash
git add macos/HarborNative src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/build.rs src-tauri/src/mac_native src-tauri/src/lib.rs
git commit -m "feat(mac): HarborNative Swift package and Rust<->Swift bridge"
```

---

### Task 3: Native window frame

**Files:**

- Modify: `src-tauri/tauri.macos.conf.json` (window keys)
- Modify: `src-tauri/src/mpv_render_mac.rs:395-425` (`install_window_rounding`: no corner radius on macOS native frame)
- Modify: `src/lib/settings/load.ts` (macOS coercion)
- Create: `src/lib/mac-chrome.ts`
- Modify: `src/App.tsx:1001` (force `"sidebar"` layout on macOS) and the `<WindowResizeEdges />` / `<HybridTitleBar />` sites (~1853–1855)
- Modify: the Settings toggles for `useNativeTitleBar` / `hybridTitleBar` (hide them on macOS; find them with `grep -rn "useNativeTitleBar" src/views/settings`)
- Test: `tests/mac-chrome.test.ts`

**Interfaces:**

- Consumes: Task 2's `HarborNativeController`.
- Produces (`src/lib/mac-chrome.ts`):
  - `export function coerceMacSettings<T extends { useNativeTitleBar: boolean; hybridTitleBar: boolean }>(s: T, os: OsClass): T` — on `"macos"` returns a copy with `useNativeTitleBar: true, hybridTitleBar: false`; otherwise returns `s` unchanged.
  - `export function macLayout<L extends string>(layout: L, os: OsClass): L | "sidebar"` — `"sidebar"` on macOS, else `layout`.
  - CSS custom properties on `document.documentElement`: `--mac-titlebar-inset` and `--mac-sidebar-inset` (px). Set from the `layout` event in Task 4/5; default `0px`.

- [ ] **Step 1: Write the failing test**

`tests/mac-chrome.test.ts`:

- `coerceMacSettings forces native title bar on macOS`: input `{useNativeTitleBar:false, hybridTitleBar:true}`, os `"macos"` → `{useNativeTitleBar:true, hybridTitleBar:false}`; input object not mutated.
- `coerceMacSettings leaves other platforms alone`: os `"windows"` → same object reference returned.
- `macLayout forces sidebar on macOS`: `macLayout("royal","macos") === "sidebar"`, `macLayout("royal","linux") === "royal"`.

- [ ] **Step 2: Run to verify it fails**

Run: `node --import ./scripts/node-test-environment.mjs --experimental-loader ./scripts/node-test-loader.mjs --test tests/mac-chrome.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/mac-chrome.ts`** with the two functions above.

- [ ] **Step 4: Run the test** (same command) → PASS.

- [ ] **Step 5: Wire it in**

- `load.ts`: apply `coerceMacSettings(parsed, osClass())` at the end of normalization, so every reader (including `loadStoredSettings()` used by `src/lib/fullscreen-state.ts:187`) sees the system frame as on. This makes the existing `setDecorations(settings.useNativeTitleBar)` effect in `src/lib/settings.tsx:437-444` keep the frame on, and makes `WindowControls`, `HybridTitleBar` and the sidebar's `hybridBar` branch render nothing.
- `App.tsx:1001`: `const layout = macLayout(kid ? "sidebar" : baseLayout, osClass());`.
- `App.tsx`: don't render `<WindowResizeEdges />` on macOS.
- Settings UI: hide the two title-bar toggles when `isMacDesktop()`.
- `tauri.macos.conf.json`: add the main window override `"app": {"windows": [{"label": "main", "decorations": true, "titleBarStyle": "Overlay", "hiddenTitle": true, "transparent": true, ...the other keys copied unchanged from tauri.conf.json}]}`. (The `windows` array is replaced, not merged, so copy every key from the main window in `tauri.conf.json`.)
- `mpv_render_mac.rs` `install_window_rounding`: keep `setOpaque:false`, the clear window background, `setWantsLayer:true` and the black content layer (mpv's child window shows through), but drop `setCornerRadius`/`setMasksToBounds`; the system frame rounds the window. Rename it `install_window_backing`, and update the call at `lib.rs:1176`. Remove the `make_resizable` call (the system frame is resizable).
- Native side: in `HarborNativeController`, make sure the window has `.fullSizeContentView` in its `styleMask` and `titlebarAppearsTransparent = true`.

- [ ] **Step 6: Checks**

Run: `pnpm run check && pnpm run typecheck && cargo check --manifest-path src-tauri/Cargo.toml` → all pass, no new warnings.

- [ ] **Step 7: Verify by hand on macOS** (record results in `docs/mac-fork/BASELINE.md` under "Task 3")

`pnpm tauri dev`, then confirm each:

1. Real traffic lights at top-left; no HTML window buttons anywhere; no HTML dots.
2. Double-click on the title-bar area zooms (or minimizes, per System Settings → Desktop & Dock).
3. Double-click on the right window edge stretches that edge to the screen edge.
4. Drag to the top-left screen corner/menu tiling snaps the window.
5. ⌃⌘F enters native full screen; exiting leaves the frame intact. Repeat via Harbor's own fullscreen (player fullscreen button), then exit.
6. Play a stream: video is visible, correctly placed and sized, including after resizing the window and in full screen.
7. Quit and relaunch: the window reopens at the saved size with the frame.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/tauri.macos.conf.json src-tauri/src/mpv_render_mac.rs src-tauri/src/lib.rs src/lib/mac-chrome.ts src/lib/settings/load.ts src/App.tsx src/views/settings tests/mac-chrome.test.ts macos/HarborNative docs/mac-fork/BASELINE.md
git commit -m "feat(mac): system window frame with traffic lights; single sidebar layout"
```

---

### Task 4: Liquid Glass toolbar — Back, sidebar toggle, native search

**Files:**

- Create: `macos/HarborNative/Sources/HarborNative/ToolbarController.swift`
- Create: `src/chrome/mac/native-toolbar-bridge.tsx`
- Create: `src/chrome/mac/native-events.ts` (typed `listen` wrapper for `mac-native://*`)
- Modify: `src/chrome/topbar.tsx` (no `SearchPill` on macOS; leave the bell/account/Together buttons)
- Modify: `src/components/search/search-overlay.tsx` (on macOS: hide its own text input, accept `harbor:native-search-key` events, open/close without scale/expand animation)
- Modify: `src/App.tsx` (render `<NativeToolbarBridge />` on macOS; drop the top `h-24` gradient overlay on macOS, around line 2333, since the toolbar's scroll-edge effect replaces it)
- Test: `macos/HarborNative/Tests/HarborNativeTests/ToolbarTests.swift`, `tests/mac-native-toolbar.test.ts`

**Interfaces:**

- Consumes: Task 2 C ABI + events; `useView()` → `{ canGoBack, goBack }` (`src/lib/view.tsx:402-403`); `useSearchActions()` → `{ setOpen, setQuery, clear }` (`src/lib/search-context-state.ts:15-25`); `useSearchOpen()`.
- Produces:
  - `src/chrome/mac/native-events.ts`: `export function onNativeEvent<K extends NativeEventKind>(kind: K, handler: (payload: NativeEventPayloads[K]) => void): () => void` and the `NativeEventKind`/`NativeEventPayloads` types mirroring Task 2's event list.
  - `export function toolbarPayload(input: { playerActive: boolean; immersive: boolean; canGoBack: boolean }): { visible: boolean; canGoBack: boolean }` (pure, in `native-toolbar-bridge.tsx`).
  - DOM event `harbor:native-search-key` (`CustomEvent<{ key: "ArrowUp"|"ArrowDown"|"Enter"|"Escape" }>`) dispatched on `window`.
  - Swift emits `layout` with `titlebarInset` = window frame height minus `contentLayoutRect` height, on install, on resize, and on toolbar visibility change.

Decision: **no Forward button.** Harbor's view stack (`src/lib/view.tsx`) has no forward history; adding one is out of scope.

- [ ] **Step 1: Write the failing tests**

Swift `ToolbarTests.swift`:

- `testToolbarItemOrder`: `ToolbarController.itemIdentifiers` equals `[.toggleSidebar, .back, .flexibleSpace, .search]`.
- `testSearchKeyMapping`: `ToolbarController.searchKey(for: #selector(NSResponder.moveUp(_:)))` is `"ArrowUp"`; for `moveDown` it is `"ArrowDown"`, for `insertNewline` `"Enter"`, for `cancelOperation` `"Escape"`, and for `moveLeft` `nil`.

TS `tests/mac-native-toolbar.test.ts`:

- `toolbar hidden during playback`: `toolbarPayload({playerActive:true, immersive:false, canGoBack:true})` → `{visible:false, canGoBack:true}`.
- `toolbar hidden when immersive`: `immersive:true` → `visible:false`.
- `toolbar visible otherwise`: `{false,false,false}` → `{visible:true, canGoBack:false}`.

- [ ] **Step 2: Run to verify they fail**

Run: `swift test --package-path macos/HarborNative` and `node --import ./scripts/node-test-environment.mjs --experimental-loader ./scripts/node-test-loader.mjs --test tests/mac-native-toolbar.test.ts`
Expected: both FAIL.

- [ ] **Step 3: Implement `ToolbarController.swift`**

An `NSToolbar` (`displayMode = .iconOnly`, window `toolbarStyle = .unified`) with: a sidebar-toggle item (`sidebar.left`) emitting `toolbar-toggle-sidebar`; a Back item (`chevron.backward`, disabled when `canGoBack == false`) emitting `toolbar-back`; flexible space; an `NSSearchToolbarItem` whose `NSSearchField` delegate emits `search-begin`, `search-text` (on every change), `search-end`, and `search-key` via `control(_:textView:doCommandBy:)` using `searchKey(for:)`, returning `true` for mapped keys. `harbor_native_toolbar_set` toggles `toolbar.isVisible` and Back's enabled state; `harbor_native_search_set` sets the field text and, if `focused`, makes the field first responder. Built on the macOS 26 SDK, the toolbar gets Liquid Glass with no extra code.

- [ ] **Step 4: Implement the bridge and web changes**

- `native-toolbar-bridge.tsx`: pushes `toolbarPayload(...)` via `invoke("mac_native_toolbar_set", { payload: JSON.stringify(...) })` whenever its inputs change. Handles `toolbar-back` → `goBack()`; `search-begin` → `setOpen(true)`; `search-text` → `setQuery(text)`; `search-end` → no-op unless text is empty, then `setOpen(false)`; `search-key` → dispatch `harbor:native-search-key`; `layout` → set `--mac-titlebar-inset`. When the web closes search (`useSearchOpen()` goes false), push `mac_native_search_set {text:"", focused:false}`. The search hotkey listener currently lives inside `SearchPill` (`topbar.tsx:433-450`), which macOS no longer renders, so the bridge installs the same `keydown` listener (`findHotkeyMatch(e, hotkeys ?? {}, "Global") === "globalSearchFocus"`) and calls `mac_native_search_set {text: "", focused: true}` instead of `setOpen(true)`.
- `toolbar-toggle-sidebar` is handled in Task 5.
- The web content column gets `padding-top: var(--mac-titlebar-inset)` on macOS (the root content container in `App.tsx` next to the existing `relative flex min-h-0 min-w-0 flex-1 flex-col` div).
- `search-overlay.tsx`: on macOS, don't render the input; subscribe to `harbor:native-search-key` and route each key to the same handler the input's `onKeyDown` uses; no scale/expand transition (a plain appear/disappear, or opacity ≤150 ms).

- [ ] **Step 5: Run tests** (both commands from Step 2) → PASS. Then `pnpm run check && pnpm run typecheck && cargo check --manifest-path src-tauri/Cargo.toml`.

- [ ] **Step 6: Verify by hand on macOS**

1. Glass toolbar with sidebar toggle, Back, and a search field; content scrolling under it shows the scroll-edge effect.
2. Typing in search shows results live; ↑/↓ move the highlight; Return opens the highlighted result; Esc closes.
3. Back is disabled on Home and works after opening a title.
4. During playback the toolbar is hidden; the traffic lights stay usable.
5. The search hotkey focuses the native field.
6. Double-clicking an empty part of the toolbar zooms the window.

- [ ] **Step 7: Commit**

```bash
git add macos/HarborNative src/chrome/mac src/chrome/topbar.tsx src/components/search/search-overlay.tsx src/App.tsx tests/mac-native-toolbar.test.ts
git commit -m "feat(mac): Liquid Glass toolbar with back, sidebar toggle and native search"
```

---

### Task 5: Floating Liquid Glass sidebar

**Files:**

- Create: `macos/HarborNative/Sources/HarborNative/SidebarView.swift` (SwiftUI list)
- Create: `macos/HarborNative/Sources/HarborNative/SidebarHost.swift` (`NSGlassEffectView` hosting `NSHostingView<SidebarView>`, added to the window's `contentView` above the webview)
- Create: `src/chrome/mac/nav-symbols.ts`
- Create: `src/chrome/mac/native-sidebar-bridge.tsx`
- Modify: `src/App.tsx` (on macOS render `<NativeSidebarBridge visible={…} />` instead of `<Sidebar />` at line ~1768, with `visible` computed from the same conditions `<Sidebar />` uses there plus `!chromeHidden`)
- Test: `tests/mac-native-sidebar.test.ts`, `macos/HarborNative/Tests/HarborNativeTests/SidebarTests.swift`

**Interfaces:**

- Consumes: `useSidebarNavigation()` → `{ entries }` where entry is `{ item: NavItem; primary: boolean; gated: boolean }` (`src/chrome/context-page-navigation.tsx:45`); `NavItem`/`NavItemId` (`src/chrome/nav-items.tsx`); `useView()` → `{ view, setView }`; `useT()`; `useUnseenReminderCount()` (`src/lib/reminders`); `ParentalPinModal` + `useParental().unlock` as used in `src/chrome/sidebar.tsx:183-195`; Task 2 `SidebarPayload`; Task 4 `onNativeEvent`.
- Produces:
  - `src/chrome/mac/nav-symbols.ts`: `export const NAV_SYMBOLS: Record<NavItemId, string>` with exactly:
    `home:"house"`, `discover:"safari"`, `catalogs:"square.grid.2x2"`, `plugins:"puzzlepiece.extension"`, `movies:"film"`, `shows:"tv"`, `music:"music.note"`, `games:"gamecontroller"`, `kids:"popcorn"`, `anime:"sparkles.tv"`, `manga:"book.pages"`, `ebook:"book"`, `live:"dot.radiowaves.left.and.right"`, `sports:"sportscourt"`, `vod:"play.rectangle.on.rectangle"`, `calendar:"calendar"`, `library:"books.vertical"`, `collections:"rectangle.stack"`, `downloads:"arrow.down.circle"`, `addons:"puzzlepiece"`, `settings:"gearshape"`.
    (Swift's `resolvedSymbol` falls back to `"circle"` for any name missing on the running OS.)
  - In `native-sidebar-bridge.tsx`: `export type SidebarEntry = ReturnType<typeof useSidebarNavigation>["entries"][number];` and `export type NativeSidebarItem = { id: string; title: string; symbol: string; section: "primary" | "collections"; active: boolean; gated: boolean; badge?: number }` (mirrors Swift `SidebarItem`).
  - `export function toNativeSidebarItems(entries: SidebarEntry[], view: View, t: (key: string) => string, opts: { renamed: Record<string,string>; kid: boolean; reminderCount: number }): NativeSidebarItem[]`. `title` is `opts.renamed[id] ?? t(item.label)`; `section` is `"primary"` when `entry.primary`; `active` is `item.view === view`; `gated` is copied; `badge` is `reminderCount` for `calendar` when > 0. When `opts.kid`, append `{id:"kids-play", title:"Play", symbol:"play.circle", section:"primary", ...}`.
  - Swift: floating pane inset **8 pt** from the window's top (below `titlebarInset`), left and bottom edges; width **240 pt**; hidden entirely when `collapsed` or `!visible` (Tahoe-style hide, not an icon rail). Emits `layout {sidebarWidth, sidebarVisible}` whenever it changes.

- [ ] **Step 1: Write the failing tests**

`tests/mac-native-sidebar.test.ts`:

- `every nav item has a symbol`: for each `id` of `NAV_ITEMS` (from `src/chrome/nav-items.tsx`), `NAV_SYMBOLS[id]` is a non-empty string.
- `maps entries with translated titles`: given entries for `home` (primary) and `library` (not primary), `t = (k) => "T:" + k`, view `"home"` → `[{id:"home", title:"T:nav.home", symbol:"house", section:"primary", active:true, gated:false}, {id:"library", …, section:"collections", active:false}]`.
- `rename wins over translation`: `renamed: {home: "Start"}` → title `"Start"`.
- `gated carried through`: an entry with `gated:true` yields `gated:true`.
- `calendar badge`: `reminderCount: 3` → the calendar item has `badge: 3`; with 0 there is no `badge` key.
- `kid play entry`: `kid: true` → last item id `"kids-play"`.

Swift `SidebarTests.swift`:

- `testSectionsSplit`: `SidebarModel(payload:)` puts `primary` items in `primary` and `collections` items in `collections`, preserving order.
- `testHiddenWhenCollapsed`: a payload with `collapsed: true` → `SidebarModel.isShown == false`; with `visible: false` → `false`; otherwise `true`.

- [ ] **Step 2: Run to verify they fail**

Run: `node --import ./scripts/node-test-environment.mjs --experimental-loader ./scripts/node-test-loader.mjs --test tests/mac-native-sidebar.test.ts` and `swift test --package-path macos/HarborNative`
Expected: FAIL.

- [ ] **Step 3: Implement Swift**

`SidebarModel` (`@Observable`) built from `SidebarPayload`. `SidebarView`: a SwiftUI `List` (`.listStyle(.sidebar)`, `.scrollContentBackground(.hidden)`) with two sections (primary, collections, no headers), rows using `Label(title, systemImage: resolvedSymbol)`, a lock glyph trailing for `gated`, and a badge for `badge`. Selection emits `sidebar-select {id}`; the highlight follows `active` from the payload, so the web stays the source of truth. `SidebarHost`: an `NSGlassEffectView` (default style, system corner radius) whose `contentView` is the `NSHostingView`; added to the window's `contentView` _above_ the `WKWebView` with Auto Layout constraints per the values above. No hover or appear animations beyond system defaults.

- [ ] **Step 4: Implement TS**

`nav-symbols.ts` and `toNativeSidebarItems` as specified. `NativeSidebarBridge`: computes the payload `{visible, collapsed: settings.sidebarCollapsed, items}` and pushes it via `invoke("mac_native_sidebar_set", …)` on change. Handles `sidebar-select`: if the item is `gated`, set the pending view and render `ParentalPinModal` exactly as `sidebar.tsx:183-195` does; if `kids-play`, do `setView("kids")` and dispatch `harbor:kids-play` as `sidebar.tsx:281-285` does; otherwise `setView(item.view)`. Handles `toolbar-toggle-sidebar` by flipping `settings.sidebarCollapsed` via the settings updater. Handles `layout` by setting `--mac-sidebar-inset` to `sidebarVisible ? sidebarWidth + 16 : 0` px.

- [ ] **Step 5: Web content beside and under the glass**

On macOS the main content column is laid out full width, so backgrounds pass under the glass. Acceptance criteria (the builder chooses the CSS):

- At rest, no text, card or button sits under the sidebar: the first column of content starts at `var(--mac-sidebar-inset)`.
- Horizontally scrolling rails (`src/components/row.tsx`) and the Home hero backdrop extend under the glass. Rails scroll their first card to the inset (`scroll-padding-inline-start`), so posters slide beneath the glass while scrolling.

- [ ] **Step 6: Run tests and checks**

Run both test commands from Step 2 → PASS. Then `pnpm run check && pnpm run typecheck && cargo check --manifest-path src-tauri/Cargo.toml`.

- [ ] **Step 7: Verify by hand on macOS**

1. A floating glass sidebar on the left with SF Symbol icons and no hover animations; posters in Home rails and the hero refract through it while scrolling.
2. Clicking each item navigates; the highlight follows, including after navigating by other means (Back, search result, ⌘-shortcut from Task 6).
3. With parental lock on, a gated item shows the PIN modal and only routes after the correct PIN; Cancel leaves the view unchanged.
4. Switching to a kid profile, renaming or hiding a tab in Settings → Theme Studio → navigation (`nav-editor.tsx`), and changing the UI language each update the sidebar immediately.
5. The toolbar's sidebar toggle hides and shows the sidebar and the content inset follows; the state survives relaunch.
6. The sidebar is hidden in Settings, the player, the stream picker and immersive mode, as the React sidebar was.

Record the dropped React-sidebar extras in `docs/mac-fork/BASELINE.md`: brand wordmark, right-click nav menu, hidden-tabs tray, Big Picture entry and the profile chip. Account stays reachable from the top bar's account button; nav editing from Settings.

- [ ] **Step 8: Commit**

```bash
git add macos/HarborNative src/chrome/mac src/App.tsx src/components/row.tsx tests/mac-native-sidebar.test.ts docs/mac-fork/BASELINE.md
git commit -m "feat(mac): floating Liquid Glass sidebar replaces React sidebar"
```

---

### Task 6: Native app menu

**Files:**

- Create: `src-tauri/src/mac_native/menu.rs`
- Create: `src/chrome/mac/native-menu-bridge.tsx`
- Modify: `src-tauri/src/mac_native/mod.rs` (`pub mod menu;`, build and set the menu during `install`)
- Modify: `src/App.tsx` (render `<NativeMenuBridge />` on macOS)
- Test: `tests/mac-native-menu.test.ts`; Rust unit test in `menu.rs`

**Interfaces:**

- Consumes: `tauri::menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem, MenuItemBuilder}`; Task 4 `onNativeEvent`, `toolbar-toggle-sidebar` handling (Task 5) and `mac_native_search_set`; `useView()`.
- Produces:
  - Rust `pub fn menu_spec() -> Vec<(&'static str, Vec<MenuEntry>)>` (pure data, unit-testable), where `MenuEntry` is `Action { id: &'static str, label: &'static str, accel: Option<&'static str> }`, `Predefined(&'static str)` or `Separator`; plus `pub fn install_menu(app: &AppHandle)`, which builds the Tauri menu from the spec and emits `mac-native://menu {action: id}` on click.
  - Menu contents (exact):
    - **Harbor:** About Harbor (predefined), Separator, `settings` "Settings…" `CmdOrCtrl+,`, Separator, Services, Hide, Hide Others, Show All (predefined), Separator, Quit (predefined).
    - **Edit:** Undo, Redo, Separator, Cut, Copy, Paste, Select All (all predefined).
    - **View:** `toggle-sidebar` "Toggle Sidebar" `Ctrl+Cmd+S`, `find` "Search" `CmdOrCtrl+F`, Separator, Enter Full Screen (predefined Fullscreen).
    - **Go:** `back` "Back" `CmdOrCtrl+[`, Separator, `go-home` "Home" `CmdOrCtrl+1`, `go-discover` "Discover" `CmdOrCtrl+2`, `go-movies` "Movies" `CmdOrCtrl+3`, `go-shows` "Shows" `CmdOrCtrl+4`, `go-library` "Library" `CmdOrCtrl+5`.
    - **Window:** Minimize, Zoom (predefined Maximize), Separator, Close Window (predefined).
  - TS `export function menuCommand(action: string): { kind: "view"; view: View } | { kind: "back" } | { kind: "toggle-sidebar" } | { kind: "find" } | null`.

- [ ] **Step 1: Write the failing tests**

Rust (in `menu.rs`):

- `edit_menu_has_clipboard_items`: the `"Edit"` entry of `menu_spec()` contains `Predefined` `"copy"`, `"paste"`, `"cut"`, `"select_all"`, `"undo"`, `"redo"`.
- `accelerators_unique`: no two `Action`s share an `accel`.

TS `tests/mac-native-menu.test.ts`:

- `go items map to views`: `menuCommand("go-home")` → `{kind:"view", view:"home"}`; likewise discover, movies, shows, library.
- `settings maps to settings view`: `menuCommand("settings")` → `{kind:"view", view:"settings"}`.
- `others`: `"back"` → `{kind:"back"}`, `"toggle-sidebar"` → `{kind:"toggle-sidebar"}`, `"find"` → `{kind:"find"}`, `"nope"` → `null`.

- [ ] **Step 2: Run to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml mac_native::menu` and `node --import ./scripts/node-test-environment.mjs --experimental-loader ./scripts/node-test-loader.mjs --test tests/mac-native-menu.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `menu.rs` (`menu_spec`, `install_menu` called from `mac_native::install`) and `native-menu-bridge.tsx` (`menuCommand` plus a listener: `view` → `setView`, unless the target is a gated nav item, in which case reuse the Task 5 PIN flow; `back` → `goBack`; `toggle-sidebar` → the same handler as the toolbar toggle; `find` → `mac_native_search_set {focused:true}`).

- [ ] **Step 4: Run tests** (both from Step 2) → PASS. Then `pnpm run check && pnpm run typecheck && cargo check --manifest-path src-tauri/Cargo.toml`.

- [ ] **Step 5: Check for hotkey clashes**

Run: `grep -n "meta" src/lib/hotkeys.ts | head -40` and review Harbor's default hotkey bindings for any ⌘-combo the menu now owns (⌘, ⌘F ⌘[ ⌘1–5 ⌃⌘S). For each clash, the menu wins on macOS; record it in `docs/mac-fork/BASELINE.md`.

- [ ] **Step 6: Verify by hand on macOS**

1. The menu bar shows Harbor / Edit / View / Go / Window with the items above.
2. In a web text field (Settings → any text input): ⌘A, ⌘C, ⌘X, ⌘V and ⌘Z all work; typing letters is never swallowed.
3. Each Go item and ⌘[ navigates; ⌘, opens Settings; ⌘F focuses the native search field; ⌃⌘S toggles the sidebar.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/mac_native src/chrome/mac src/App.tsx tests/mac-native-menu.test.ts docs/mac-fork/BASELINE.md
git commit -m "feat(mac): native app menu with Edit, View, Go and Window menus"
```

---

### Task 7: Side-by-side run and workstream sign-off

**Files:**

- Modify: `docs/mac-fork/BASELINE.md`

- [ ] **Step 1: Run alongside installed Harbor**

Open `/Applications/Harbor.app`, then `pnpm tauri dev`. Expected: both run; play a stream in each, one after another. If either fails to start a local service (cast server, torrent engine, LAN), record the port clash and move the fork's port in its owning module.

- [ ] **Step 2: Data carry-over**

In installed Harbor, export a backup (Settings → backup). In the fork, restore it. Expected: profiles, addons, TMDB key and library appear.

- [ ] **Step 3: Full test pass**

Run: `pnpm test`, `swift test --package-path macos/HarborNative`, `cargo test --manifest-path src-tauri/Cargo.toml mac_native`
Expected: the new tests pass. For pre-existing failures, compare against a `pnpm test` run on `beta-branch` and record the baseline. Don't fix unrelated failures.

- [ ] **Step 4: Commit**

```bash
git add docs/mac-fork/BASELINE.md
git commit -m "docs(mac): workstream 1 verification results"
```
