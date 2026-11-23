import { useEffect, useRef } from "react";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { useSettings } from "@/lib/settings";
import { tracePlayback } from "@/lib/player/pause-trace";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function usePauseOnInactive({
  bridgeRef,
  snapRef,
}: {
  bridgeRef: React.RefObject<PlayerBridge | null>;
  snapRef: React.RefObject<PlayerSnapshot>;
}) {
  const { settings } = useSettings();
  const pauseMinimized = settings.pauseMinimized;
  const pauseUnfocused = settings.pauseUnfocused;
  const autoPausedRef = useRef(false);
  // macOS: the window was put away with the red button or ⌘W, which is leaving, not looking
  // away. Playback pauses whatever the two settings say and stays paused when the window is
  // brought back.
  const windowClosedRef = useRef(false);
  const pausePrefsRef = useRef({ pauseMinimized, pauseUnfocused });
  pausePrefsRef.current = { pauseMinimized, pauseUnfocused };

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<{ focused: boolean; minimized: boolean }>("harbor://window-activity", (e) => {
        const prefs = pausePrefsRef.current;
        tracePlayback(
          `window-activity focused=${e.payload.focused} minimized=${e.payload.minimized} pauseMinimized=${prefs.pauseMinimized} pauseUnfocused=${prefs.pauseUnfocused}`,
        );
        window.dispatchEvent(new Event("harbor:mpv-force-geom"));
      }).then((u) => {
        if (cancelled) u();
        else unlisten = u;
      }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen("harbor://window-closed", () => {
        windowClosedRef.current = true;
        autoPausedRef.current = false;
        const bridge = bridgeRef.current;
        if (!bridge || bridge.capabilities().external) return;
        if (snapRef.current.status === "playing") bridge.pause("window closed");
      }).then((u) => {
        if (cancelled) u();
        else unlisten = u;
      }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [bridgeRef, snapRef]);

  useEffect(() => {
    if (!isTauri) return;
    if (!pauseMinimized && !pauseUnfocused) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<{ focused: boolean; minimized: boolean }>("harbor://window-activity", (e) => {
        const bridge = bridgeRef.current;
        // Switching to the user's own external mpv window does not mean leaving, so don't pause the playback.
        if (!bridge || bridge.capabilities().external) return;
        const { focused, minimized } = e.payload;
        if (windowClosedRef.current) {
          if (focused) windowClosedRef.current = false;
          return;
        }
        if (!focused) {
          const shouldPause = minimized ? pauseMinimized : pauseUnfocused;
          if (shouldPause && snapRef.current.status === "playing") {
            autoPausedRef.current = true;
            bridge.pause(`inactive focused=false minimized=${minimized}`);
          }
        } else if (autoPausedRef.current) {
          autoPausedRef.current = false;
          void bridge.play({ reason: "inactive-resume" });
        }
      }).then((u) => {
        if (cancelled) u();
        else unlisten = u;
      }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [bridgeRef, snapRef, pauseMinimized, pauseUnfocused]);
}
