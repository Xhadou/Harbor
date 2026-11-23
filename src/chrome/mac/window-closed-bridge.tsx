import { useEffect } from "react";
import { exitAnyFullscreen } from "@/lib/fullscreen-state";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";
import { flushPendingTorrentRemovals } from "@/lib/torrent/local-engine";
import { flushCloudSync } from "@/views/player/hooks/use-stremio-sync";

/** Sent by the native side when the red button or ⌘W puts the main window away. */
export const WINDOW_CLOSED_EVENT = "harbor://window-closed";

/**
 * On a Mac, closing the window leaves Harbor running. The page's share of that:
 * leave full screen (the native side waits for it before hiding the window) and
 * save what quitting would save, since ⌘Q from the Dock later gives no chance to.
 * The player pauses itself (`usePauseOnInactive`).
 */
export function WindowClosedBridge() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen(WINDOW_CLOSED_EVENT, () => {
        void exitAnyFullscreen();
        void flushCloudSync().catch(() => {});
        void flushPendingTorrentRemovals().catch(() => {});
      }).then((rawUnlisten) => {
        const stop = makeSafeTauriUnlisten(rawUnlisten);
        if (cancelled) stop();
        else unlisten = stop;
      }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return null;
}
