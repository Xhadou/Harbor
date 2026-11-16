# Harbor for Mac — native fork design

Date: 2026-11-16
Status: draft, awaiting approval

## Intent

Fork Harbor (github.com/Harborofficial/Harbor, branch `beta-branch`, v1.0.3) into a
personal Mac app that feels like it was made for macOS. Today Harbor is a Tauri 2 app
whose UI was shaped around Windows: it hides the system window frame and draws its own
min/max/close buttons, animates nearly every hover, and feels slow — images arrive late
while scrolling and when opening titles, and scrolling itself is laggy.

This becomes **its own app**. Tracking upstream Harbor is not a goal; we may restructure
freely. Upstream sync can be revisited later if it ever matters.

## Goals

1. **Real Mac window behavior.** System traffic lights, double-click title bar to zoom
   (honoring the user's System Settings choice), double-click an edge to stretch it to
   the screen edge, window tiling/snapping, native full screen, native app menu with
   standard ⌘ shortcuts.
2. **Images are there when you look.** Posters/backdrops visible as cards scroll in and
   as a title page opens, instead of blank boxes filling in late.
3. **Smooth scrolling.** No dropped frames while scrolling Home/catalog rails on a
   trackpad, momentum and rubber-banding intact.
4. **Calm motion.** Remove decorative hover animations from navigation; search
   expands/collapses like a native toolbar search field. Motion only where it explains
   a change of state.
5. **A native player.** Player controls rebuilt in SwiftUI over the existing native
   libmpv video surface.
6. **Liquid Glass (user request).** The app adopts macOS 26+'s Liquid Glass design
   language using the real system materials: glass toolbar, a floating glass sidebar,
   glass player controls, and system menus/popovers. Web content scrolls beneath the
   glass so it refracts posters and backdrops the way native apps do.

## Non-goals

- Windows, Linux, Android, TV builds. Their code may remain in the tree but is not
  maintained, tested, or kept compiling. (Builder may delete it when it gets in the way.)
- Rewriting browse screens (Home, Discover, Detail, Settings…) in SwiftUI. They stay
  React and get a performance and motion pass. A later project may move them.
- Replacing libmpv or its OpenGL render path (libmpv's render API only supports OpenGL
  for embedding; IINA does the same). No Metal port.
- Signed/notarized distribution, auto-updater, public releases.
- Keeping merges with upstream easy.

## Anti-goals (would be failure even if it "works")

- Imitations of native controls drawn in HTML where a real AppKit/SwiftUI control exists
  (fake traffic lights, fake menus, fake search fields).
- CSS-faked glass (`backdrop-filter` blur + gradients posing as Liquid Glass). Glass
  comes only from `NSGlassEffectView` / SwiftUI `glassEffect`. Web surfaces that
  aren't native stay plain and quiet rather than imitating it.
- Bouncy, scaling, glowing, or attention-seeking motion. If in doubt, no animation.
- Losing a player feature the user relies on today without saying so. Anything the
  native player doesn't do yet must still be reachable.
- "Faster" claims without before/after measurements.

## Constraints and facts from the codebase

- Stack: React 19 + Vite + Tailwind 4 frontend (`src/`), Tauri 2 shell and Rust backend
  (`src-tauri/`, plus `harbor-core/`). 605 `#[tauri::command]`s; the frontend makes 784
  `invoke` calls. This IPC surface is why Tauri stays the host.
- Window: `src-tauri/tauri.conf.json` sets `"decorations": false`. Window chrome lives in
  `src/chrome/` (`window-controls.tsx`, `hybrid-title-bar.tsx` with HTML `MacDots`,
  `window-resize-edges.tsx`, `topbar.tsx`, `sidebar.tsx`). Settings already have
  `useNativeTitleBar` and `hybridTitleBar` flags.
- Player video: `src-tauri/src/mpv_render_mac.rs` renders libmpv into an `NSOpenGLView`
  in a borderless child `NSWindow` ordered below the main window; the webview draws the
  controls on top. `src-tauri/src/mpv.rs` exposes `mpv_command`, `mpv_set_property`,
  `mpv_get_property`, `mpv_set_geometry`, etc., and emits `mpv://event`.
- Player UI: `src/views/player.tsx` + `src/views/player/` (~7.3k lines) and
  `src/components/player/` (60 entries, ~26k lines). It includes transport, tracks/subs,
  stream switcher, next episode/episode panel, skip intro/outro pills, watch-party
  (room/chat/draw), casting, live TV/DVR, stats, screenshots/GIF/clips, ad-report.
- Images: TMDB/Metahub art is loaded directly by `<img>` (491 `loading="lazy"` sites);
  size chosen by `src/lib/image-rung.ts`. A Rust SQLite disk cache exists
  (`src-tauri/src/thumb_cache.rs`, 2 GB cap) but ordinary posters don't go through it.
  `src/lib/remote-image-proxy.ts` proxies only special cases (plain-http, auth, referer).
- Blur: 595 `backdrop-blur`/`backdrop-filter` uses. Prime suspect for scroll jank in
  WKWebView; must be confirmed by profiling, not assumed.
- `smoothScroll` (JS wheel easing, `src/lib/smooth-scroll.ts`) is off by default; not the
  cause of default lag.
- macOS deps already present: `objc2`, `objc2-app-kit`, `objc2-web-kit`, `window-vibrancy`.
- Platform: user is on current macOS on Apple Silicon.

## Approaches considered

- **A. Tauri stays host; native parts added in.** Native window frame + toolbar via
  AppKit; SwiftUI player controls; web screens tuned. Fastest relief, nothing breaks
  along the way. Browse screens remain web.
- **B. Swift/AppKit app as host, React embedded in WKWebView, Rust linked as a library.**
  Cleanest base for an all-SwiftUI future, but requires rebuilding the bridge behind 784
  IPC calls before any user-visible improvement.
- **C. A, but with native code kept portable.** Swift code (player, chrome) lives in its
  own Swift package with a narrow interface to Rust, so it could move to a Swift host
  later without a rewrite.

**Chosen: A, built C-style** (user approved "your way"). Most of the complaints are about
how existing screens behave, which A fixes soonest; C's discipline keeps B open cheaply.

## Design

### Architecture

- A Swift package (e.g. `macos/HarborNative/`) built as a static library and linked into
  the Tauri binary from `build.rs`. It owns all SwiftUI/AppKit UI we add.
- Rust ⇄ Swift boundary is narrow and explicit: a small C-ABI (or `swift-bridge`)
  surface — "player state snapshot", "player command", "window/toolbar events". Swift
  never calls Tauri APIs; Rust never touches SwiftUI types. This is what keeps option B
  open.
- Web ⇄ native coordination goes through existing Tauri events/commands (e.g. the web
  side asks Rust to open the native player; Rust tells the web side when it closes).

### Workstream order

Each workstream gets its own implementation plan and ships independently.

1. **Fork setup + native window.** Repo is cloned at `~/Developer/stremio-better` on branch
   `mac-native` (old folder backed up at `~/Developer/stremio-better-backup-2026-11-16.tar.gz`). Give the app a
   distinct bundle identifier so it doesn't share data or collide with installed Harbor.
   Turn system decorations on for macOS with a transparent/overlay title bar and real
   traffic lights; remove HTML window controls, `MacDots`, the HTML menu bar and resize
   edges on macOS. Native `NSToolbar` with an `NSSearchToolbarItem` drives the existing
   search; built against the macOS 26+ SDK, the toolbar gets Liquid Glass and the
   scroll-edge effect automatically. **Native glass sidebar:** the React sidebar is
   replaced on macOS by a SwiftUI navigation list inside a floating `NSGlassEffectView`
   pane, layered over the left edge of the webview (web content gets a matching left
   inset and scrolls underneath). Selecting an item tells the web app to route; the web
   app tells the sidebar which item is active. Profile/account sits at the sidebar
   foot as today. Native app menu wired to existing actions. Also sets up the Swift
   package and build plumbing the later workstreams use.
2. **Images and loading.** Measure first. Then: prefetch art one to two viewports ahead;
   prefetch a title's backdrop/logo on card hover/focus; route TMDB/Metahub art through
   a persistent disk cache served via a custom URL scheme (reuse/extend `thumb_cache.rs`)
   so revisits and relaunches are instant; placeholder color per card, short fade-in.
3. **Scroll and motion.** Profile scroll on Home and a catalog in Safari Web Inspector /
   Instruments. Fix what's measured (blur layers, layout thrash, oversized images,
   non-passive listeners). Strip decorative transitions from nav; tone global
   motion to short, ease-out, opacity/translate only; honor Reduce Motion. Remove the
   web layer's fake-glass `backdrop-blur` from surfaces that native glass now covers,
   and from any remaining web surface where profiling shows it costs frames.
4. **Native player — mpv for everything (user decision).** On macOS every source plays
   through embedded libmpv: VOD, local files, home servers, and live TV/IPTV/DVR. The
   HTML5 `<video>` path and the `playerEngine: "auto"` fallback logic
   (`src/views/player/hooks/use-player-bridge.ts`) are disabled on macOS, and so are
   the non-embedded/external mpv modes. Live TV, DVR and multiview must be re-verified
   on mpv. Audio-track switching (Hindi/dual audio) is a key use case and must work
   everywhere.
   SwiftUI controls, styled with `glassEffect`/`GlassEffectContainer`, in an
   `NSHostingView` above the mpv surface:
   play/pause, scrubber with buffered ranges, time, volume, audio/subtitle track menus,
   subtitle delay/size, playback speed, full screen, next episode, skip intro/outro,
   stream switcher, episode list. Native keyboard handling and Now Playing/media keys.
   Features not rebuilt in v1 (watch party, casting, live TV/DVR, drawing, GIF/clip,
   ad-report, stats) remain reachable — by keeping the web overlay for them, or a
   "More" entry that opens the web panel — and are listed explicitly in the plan.

### Success measures

Recorded before and after on the same machine and network, in the plan's verification:

- Home: time from a card entering the viewport to its image painted; count of blank
  cards visible during a fast scroll.
- Detail: click-to-backdrop-painted time, cold and warm cache.
- Scroll: frame times while flicking Home rails (target: no frames over 16.7 ms on a
  60 Hz display / 8.3 ms on ProMotion in steady scroll).
- Window: checklist of the macOS behaviors in Goal 1, each verified by hand.

## Calls made in writing this up (user to check)

- **Repo:** `~/Developer/stremio-better` becomes Harbor's history (`beta-branch`), with
  `upstream` pointing at Harborofficial/Harbor. The old stremio-web `.git` is discarded
  (backup tarball keeps it). Work happens on a branch off `beta-branch`. No push remote
  until the user asks for a GitHub fork.
- **Layout:** the Mac build supports one navigation layout, the default left sidebar the
  user runs today. Alternative chrome (dracula/nord/forest sidebars, stremio rail, minui
  dock, royal/top bars, hybrid title bar) is removed or disabled on macOS. The sidebar
  becomes native (see workstream 1), because real Liquid Glass can't be applied to HTML.
- **Minimum macOS 26 (Tahoe).** Liquid Glass APIs require it; the user runs macOS 27
  with Xcode 27.2.
- **Web content under glass:** in-page controls (hero Play / Add to Watchlist, cards,
  web modals) stay web and are restyled flat to sit comfortably next to glass, not to
  imitate it. Harbor's in-app themes keep applying to web content only.
- **Toolbar:** back/forward and the native search field. Notifications/account stay in
  the web UI for now.
- **Data:** distinct bundle identifier, so the fork runs side by side with installed
  Harbor. On first launch, offer a one-time import of settings/profiles from
  `~/Library/Application Support/app.harbor`; never write to Harbor's folder. If the two
  apps clash on local ports/services when running together, the fork moves its own.
- **Measurements:** baselines are taken with the user's own theme and layout.

## Left to the builder

- Swift ⇄ Rust bridging mechanism (`swift-bridge`, `swift-rs`, or hand-written C ABI).
- How the SwiftUI layer is stacked relative to the mpv child window and the webview.
- Cache key/eviction details, URL scheme name, prefetch distances.
- Exact motion tokens.
- Exact glass variants/tints and sidebar dimensions, within Apple's HIG for macOS 26+.
- Whether to delete non-mac platform code.
