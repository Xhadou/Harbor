import { useLayoutEffect, useState } from "react";
import { isMacDesktop } from "@/lib/platform";
import type { PlayerSrc } from "@/lib/view";

/**
 * How long leaving the player takes on macOS: the page fades in over the muted video
 * while the player's controls fade out (index.css, "Leaving the player").
 */
export const PLAYER_LEAVE_MS = 340;

/** On the root while the player leaves. */
const LEAVING_ATTR = "data-player-leaving";

function fades(): boolean {
  return isMacDesktop() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The player that has just been closed, kept for `PLAYER_LEAVE_MS` so it can leave
 * gradually; null otherwise.
 *
 * The video is a native view under the transparent web page, so no picture of it can be
 * taken for a page transition: closing the player used to be an immediate change. Kept
 * mounted, the player keeps the video there (and the page transparent) while the page
 * comes in over it, and only then goes, under a page that already covers it.
 *
 * Worked out while rendering, not in an effect: a render without the player would unmount
 * it, and its unmounting is what takes the video away.
 */
export function useLeavingPlayer(player: PlayerSrc | null, active: boolean): PlayerSrc | null {
  const [seen, setSeen] = useState({ player, active });
  const [leaving, setLeaving] = useState<PlayerSrc | null>(null);
  if (seen.player !== player || seen.active !== active) {
    const closed = player === null && seen.player !== null && seen.active;
    setSeen({ player, active });
    setLeaving(closed && !seen.player!.officialBroadcast && fades() ? seen.player : null);
  }

  // The page in front again is laid out and drawn anew, and that frame is long (226 ms in
  // the dev app): a fade started with it was over before anything was drawn, and the page
  // came in at once. It waits at its start (index.css) until the page has been drawn, under
  // the video still running, and only then runs.
  useLayoutEffect(() => {
    if (!leaving) return;
    const root = document.documentElement;
    root.setAttribute(LEAVING_ATTR, "");
    let second = 0;
    let done = 0;
    const run = () => {
      if (done) return;
      root.setAttribute(LEAVING_ATTR, "run");
      done = window.setTimeout(() => setLeaving(null), PLAYER_LEAVE_MS);
    };
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(run);
    });
    // A window not being drawn produces no frames; it must not keep the player.
    const stuck = window.setTimeout(run, 1000);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      window.clearTimeout(stuck);
      window.clearTimeout(done);
      root.removeAttribute(LEAVING_ATTR);
    };
  }, [leaving]);

  return player ? null : leaving;
}
