import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode, Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { hydrateCustomThemes } from "@/lib/custom-themes";
import { getUiLanguage } from "@/lib/i18n/store";
import { ensureUiLocale } from "@/lib/i18n/load-locale";
import { applyOsDataset, isMacDesktop } from "@/lib/platform";
import { firstScreenPainted } from "@/lib/first-screen";
import { loadLottie } from "@/lib/lottie-lazy";
import { loadSecrets } from "@/lib/secret-store";
import { moveSecretsOutOfStoredSettings } from "@/lib/settings/secret-fields";
import { getInstallFeatures, loadInstallFeatures } from "@/lib/features/install";
import { HAS_MUSIC } from "@/lib/features/edition";
import { initSubtitleCache } from "@/lib/subtitles/subtitle-cache";
import { hdrOverlayEmitAction } from "@/lib/hdr-overlay";
import "@/index.css";
import "flag-icons/css/flag-icons.min.css";
import { startTaskbarProgress } from "@/lib/download/taskbar-progress";
import { completeBetaReturnPreferences } from "@/lib/updater/beta-return";
import { proactiveStorageCleanup } from "@/lib/storage-recovery";

// The small windows (captions, overlays, picture in picture) load this same page. Each is
// fetched by the window that shows it, because between them they import the whole player
// interface, which the main window would otherwise carry through every launch.
const CaptionsApp = lazy(() =>
  import("@/views/captions-app").then((module) => ({ default: module.CaptionsApp })),
);
const ModalOverlayApp = lazy(() =>
  import("@/views/modal-overlay-app").then((module) => ({ default: module.ModalOverlayApp })),
);
const HdrOverlayApp = lazy(() =>
  import("@/views/hdr-overlay-app").then((module) => ({ default: module.HdrOverlayApp })),
);
const PipApp = lazy(() => import("@/views/pip").then((module) => ({ default: module.PipApp })));
const VideoPipApp = lazy(() =>
  import("@/views/video-pip").then((module) => ({ default: module.VideoPipApp })),
);

// Loaded only when a DJ window is actually opened; not part of the core entry graph.
const importDjDeck = (): Promise<typeof import("@/views/dj-deck-app")> =>
  HAS_MUSIC ? import("@/views/dj-deck-app") : new Promise(() => {});
const DjDeckApp = lazy(() => importDjDeck().then((module) => ({ default: module.DjDeckApp })));

// The awards table is 2.6 MB of data that has to be in place before the first card is drawn.
// Asked for here, it is fetched and parsed beside this script, not as part of it.
const awardsReady = import("@/lib/awards-history-eager").catch(() => {});

let returnPreferencesReady = true;

function detectRemoteMode(): boolean {
  try {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/remote" || path.endsWith("/remote")) return true;
    if (path === "/reader" || path.endsWith("/reader")) return true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("remote") === "1" || q.get("reader") === "1") return true;
  } catch {}
  return false;
}

function detectPipMode(): boolean {
  if (new URLSearchParams(window.location.search).get("pip") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-pip") return true;
  } catch {}
  return false;
}

/** The detached player window: chrome only, with the live mpv surface behind it. */
function detectVideoPip(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-video-pip") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-video-pip") return true;
  } catch {}
  return false;
}

function detectModalOverlay(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-modal") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-modal-overlay") return true;
  } catch {}
  return false;
}

function detectDjDeck(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-dj") === "1") return true;
  try {
    if (getCurrentWindow().label === "harbor-dj") return true;
  } catch {}
  return false;
}

function detectCaptions(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-captions") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-captions") return true;
  } catch {}
  return false;
}

function detectHdrOverlay(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-overlay") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-hdr-overlay") return true;
  } catch {}
  return false;
}

const isPip = detectPipMode();
const isVideoPip = detectVideoPip();
const isModal = detectModalOverlay();
const isHdrOverlay = detectHdrOverlay();
const isCaptions = detectCaptions();
const isDjDeck = detectDjDeck();
if (isDjDeck) {
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || (event.ctrlKey && event.key.toLowerCase() === "w")) {
      void import("@tauri-apps/api/window")
        .then(({ getCurrentWindow }) => getCurrentWindow().close())
        .catch(() => {});
    }
  });
}
const isRemote = detectRemoteMode();
applyOsDataset();
// Ask for the window now: the splash is on the page already. Waiting for the page to finish
// loading would wait for whatever it has fetched by then (see harbor_page_started in lib.rs).
if ("__TAURI_INTERNALS__" in window && !isRemote && getCurrentWindow().label === "main") {
  void import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke("harbor_page_started"))
    .catch(() => {});
}
if (isRemote) {
  document.documentElement.style.overflow = "auto";
  document.body.style.overflow = "auto";
  document.body.style.userSelect = "auto";
  document.body.style.cursor = "auto";
}
if (isModal || isHdrOverlay || isVideoPip) {
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.body.style.backgroundColor = "transparent";
  const root = document.getElementById("root");
  if (root) {
    root.style.background = "transparent";
    root.style.backgroundColor = "transparent";
  }
}
if (import.meta.env.DEV)
  console.log(
    "[harbor] entry: pip =",
    isPip,
    "modal =",
    isModal,
    "hdr =",
    isHdrOverlay,
    "remote =",
    isRemote,
    "label =",
    (() => {
      try {
        return getCurrentWindow().label;
      } catch {
        return "?";
      }
    })(),
  );
if (import.meta.env.DEV && !isPip && !isVideoPip && !isModal && !isHdrOverlay && !isRemote) {
  void import("./lib/streams/__fixtures__/verify").then((m) => m.logVerificationReport());
}
function revealRoot() {
  const root = document.getElementById("root");
  if (root instanceof HTMLElement) {
    root.removeAttribute("data-startup-hidden");
    root.inert = false;
  }
}

function StartupReady() {
  useEffect(() => {
    requestAnimationFrame(() => {
      document.getElementById("harbor-boot")?.remove();
      document.getElementById("harbor-boot-chrome")?.remove();
      revealRoot();
    });
  }, []);
  return null;
}

/**
 * Minimum time the boot splash stays up before the app is revealed.
 *
 * The seconds after mount are the heaviest in the app's life: the home feed loads dozens of rows
 * and every background runner starts at once. Revealing during that window shows the user raw
 * loading jank; holding the splash through it means the first frame they see is a settled one.
 * This is the one constant to tune — raise it to hide more of the load, lower it to reach content
 * sooner.
 */
const MIN_BOOT_MS = 1800;

/**
 * macOS does not hold the splash for a fixed time. It lifts when the first screen's pictures
 * are in (lib/first-screen.ts), and waits for them no longer than this after the app is ready.
 */
const MAC_FIRST_SCREEN_CAP_MS = 1200;

function MainRoot() {
  const [appReady, setAppReady] = useState(false);
  const markAppReady = useCallback(() => setAppReady(true), []);
  const mountedAt = useRef(performance.now());

  // Acknowledge startup and take focus as soon as the app is mounted. The window is already on
  // screen showing the splash, and holding focus back would let the user click elsewhere first.
  useEffect(() => {
    if (!appReady || !("__TAURI_INTERNALS__" in window)) return;
    void import("@tauri-apps/api/core").then(async ({ invoke }) => {
      await invoke("harbor_startup_ready").catch(() => {});
      if (returnPreferencesReady) {
        try {
          await invoke("handoff_confirm");
          const pending = JSON.parse(localStorage.getItem("harbor.update.pending") ?? "null");
          if (pending?.recoverable && pending.version === __APP_VERSION__) {
            localStorage.removeItem("harbor.update.pending");
          }
        } catch {
          /* Keep pending state and recovery files if startup cannot be acknowledged. */
        }
      }
    });
  }, [appReady]);

  useEffect(() => {
    if (!appReady) return;
    const reveal = () => {
      revealRoot();
      const boot = document.getElementById("harbor-boot");
      if (boot) {
        boot.classList.add("gone");
        setTimeout(() => boot.remove(), 280);
      }
    };
    if (isMacDesktop()) {
      let cancelled = false;
      void firstScreenPainted(MAC_FIRST_SCREEN_CAP_MS).then(() => {
        if (!cancelled) reveal();
      });
      return () => {
        cancelled = true;
      };
    }
    const wait = Math.max(0, MIN_BOOT_MS - (performance.now() - mountedAt.current));
    const timer = window.setTimeout(reveal, wait);
    return () => window.clearTimeout(timer);
  }, [appReady]);

  return <App onReady={markAppReady} />;
}

/** PIP, modal, captions, HDR overlay, DJ deck and the detached player all load this same
 *  index.html and share its localStorage. Opening one must not evict caches the main window
 *  is in the middle of using. */
const isAuxWindow = isPip || isVideoPip || isModal || isHdrOverlay || isCaptions || isDjDeck;

async function mount() {
  // Must run before anything writes: on a full localStorage every setItem throws, and the
  // first unguarded one during the initial render kills the tree before onReady fires, so
  // the boot splash never clears. Cleaning up from inside a component is too late.
  if (!isAuxWindow) proactiveStorageCleanup();
  await loadInstallFeatures();
  const musicEnabled = HAS_MUSIC && getInstallFeatures().music;
  if (
    "__TAURI_INTERNALS__" in window &&
    !isHdrOverlay &&
    !isModal &&
    !isCaptions &&
    !isPip &&
    !isVideoPip &&
    !isDjDeck &&
    !isRemote
  ) {
    returnPreferencesReady = completeBetaReturnPreferences(__APP_VERSION__);
  }
  await Promise.all([
    awardsReady,
    loadSecrets(),
    hydrateCustomThemes().catch(() => {}),
    ensureUiLocale(getUiLanguage()),
    HAS_MUSIC && musicEnabled && !isHdrOverlay && !isModal && !isCaptions && !isPip && !isVideoPip
      ? import("@/lib/music/player").then(({ initializeMusic }) => initializeMusic())
      : Promise.resolve(),
  ]);
  // Keys an older build left in stored copies of the settings move to the secret store.
  if (!isAuxWindow && "__TAURI_INTERNALS__" in window) moveSecretsOutOfStoredSettings();
  if (!isHdrOverlay && !isModal && !isCaptions && !isDjDeck) void initSubtitleCache();
  if (!isHdrOverlay && !isModal && !isCaptions && !isPip && !isVideoPip && !isDjDeck)
    startTaskbarProgress();
  // The loading animation's player is fetched on first use; fetch it once the launch is over
  // so the first loader a page shows starts moving at once.
  if (!isAuxWindow) window.setTimeout(() => void loadLottie().catch(() => {}), 4000);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {isAuxWindow ? (
        // One boundary around the window's app and StartupReady, so the splash is taken
        // down when the app is on screen and not while its script is still arriving.
        <Suspense fallback={null}>
          {isHdrOverlay ? (
            <HdrOverlayApp />
          ) : isDjDeck ? (
            musicEnabled ? (
              <DjDeckApp />
            ) : null
          ) : isCaptions ? (
            <CaptionsApp />
          ) : isModal ? (
            <ModalOverlayApp />
          ) : isVideoPip ? (
            <VideoPipApp />
          ) : (
            <PipApp />
          )}
          {!isHdrOverlay && <StartupReady />}
        </Suspense>
      ) : (
        <MainRoot />
      )}
    </StrictMode>,
  );
}
void mount().catch(() => {
  if (isHdrOverlay) {
    void hdrOverlayEmitAction("hdr-stage://dead", {
      stageId: new URLSearchParams(window.location.search).get("stageId"),
    });
  }
  console.error("[harbor] application startup failed");
});
