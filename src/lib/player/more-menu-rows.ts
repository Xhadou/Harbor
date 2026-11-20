import type { PlayerControlId } from "@/lib/player-chrome";
import type { DownloadStatus } from "@/views/player/hooks/use-video-download";

export type MoreMenuAction =
  | { kind: "panel"; control: PlayerControlId }
  | { kind: "screenshot" }
  | { kind: "download-start" }
  | { kind: "download-cancel" }
  | { kind: "download-reveal" }
  | { kind: "download-reset" }
  | { kind: "song-id" }
  | { kind: "draw-toggle" }
  | { kind: "draw-clear" }
  | { kind: "draw-hide-others" }
  | { kind: "none" };

export type MoreMenuRow = {
  key: string;
  /** Panels open something further; actions happen at once. */
  group: "panels" | "actions";
  /** English text, which is also the translation key. */
  label: string;
  /** The choice in effect, or a short status. Already display text. */
  detail?: string;
  disabled?: boolean;
  active?: boolean;
  action: MoreMenuAction;
};

export type MoreMenuState = {
  engine: "html5" | "mpv";
  isLiveChannel: boolean;
  hasChapters: boolean;
  canCrop: boolean;
  /** Set when the picture is not on its default fit. */
  cropLabel: string | null;
  canShade: boolean;
  anime4kAvailable: boolean;
  /** Set when an Anime4K mode is forced on. */
  anime4kLabel: string | null;
  hasInstalledShaders: boolean;
  download: DownloadStatus | undefined;
  canDownload: boolean;
  showDraw: boolean;
  drawMode: boolean;
  hideOthersDrawings: boolean;
  songIdEnabled: boolean;
  songIdPending: boolean;
};

function downloadRow(status: DownloadStatus): MoreMenuRow {
  const base = { key: "download", group: "actions" } as const;
  switch (status.kind) {
    case "preparing":
      return { ...base, label: "Preparing download", disabled: true, action: { kind: "none" } };
    case "downloading":
      return {
        ...base,
        label: "Cancel download",
        detail: status.totalBytes ? `${Math.round(status.ratio * 100)}%` : undefined,
        action: { kind: "download-cancel" },
      };
    case "done":
      return { ...base, label: "Show downloaded file", action: { kind: "download-reveal" } };
    case "error":
      return {
        ...base,
        label: "Download failed",
        detail: status.message,
        action: { kind: "download-reset" },
      };
    default:
      return { ...base, label: "Download", action: { kind: "download-start" } };
  }
}

function rowsFor(control: PlayerControlId, s: MoreMenuState): MoreMenuRow[] {
  const mpv = s.engine === "mpv";
  const panel = (key: string, label: string, detail?: string | null): MoreMenuRow => ({
    key,
    group: "panels",
    label,
    detail: detail ?? undefined,
    action: { kind: "panel", control },
  });
  switch (control) {
    case "chapter-menu":
      return s.hasChapters ? [panel("chapters", "Chapters")] : [];
    case "aspect-menu":
      return mpv && s.canCrop ? [panel("picture", "Picture and aspect ratio", s.cropLabel)] : [];
    case "anime4k-menu":
      return mpv && s.canShade && s.anime4kAvailable
        ? [panel("anime4k", "Anime4K", s.anime4kLabel)]
        : [];
    case "shader-menu":
      if (!mpv || !s.canShade || !(s.anime4kAvailable || s.hasInstalledShaders)) return [];
      return [panel("shaders", s.anime4kAvailable ? "Anime4K and shaders" : "Shaders")];
    case "screenshot":
      return [
        {
          key: "screenshot",
          group: "actions",
          label: "Screenshot",
          action: { kind: "screenshot" },
        },
      ];
    case "download":
      return s.canDownload && !s.isLiveChannel && s.download ? [downloadRow(s.download)] : [];
    case "song-id":
      return s.songIdEnabled
        ? [
            {
              key: "song-id",
              group: "actions",
              label: "Identify song",
              disabled: s.songIdPending || undefined,
              action: { kind: "song-id" },
            },
          ]
        : [];
    case "draw-toggle": {
      if (!s.showDraw) return [];
      const draw: MoreMenuRow = {
        key: "draw",
        group: "actions",
        label: s.drawMode ? "Stop drawing" : "Draw on screen",
        active: s.drawMode || undefined,
        action: { kind: "draw-toggle" },
      };
      if (!s.drawMode) return [draw];
      return [
        draw,
        {
          key: "draw-clear",
          group: "actions",
          label: "Clear drawings",
          action: { kind: "draw-clear" },
        },
        {
          key: "draw-hide-others",
          group: "actions",
          label: s.hideOthersDrawings ? "Show others' drawings" : "Hide others' drawings",
          action: { kind: "draw-hide-others" },
        },
      ];
    }
    default:
      return [];
  }
}

/**
 * The rows of the player's More menu: one or more per control it was handed,
 * left out when the player cannot do what the row would offer. A control's
 * place on the bar may depend on how wide the bar is; its row here does not.
 */
export function moreMenuRows(
  controls: readonly PlayerControlId[],
  s: MoreMenuState,
): MoreMenuRow[] {
  return controls.flatMap((control) => rowsFor(control, s));
}
