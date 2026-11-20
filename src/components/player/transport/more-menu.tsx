import {
  AudioLines,
  Camera,
  ChevronRight,
  CircleCheck,
  Download,
  Ellipsis,
  Eraser,
  Eye,
  Layers,
  ListTree,
  Pencil,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useIdentifySong } from "@/components/identify-song-button";
import { useT } from "@/lib/i18n";
import { ANIME4K_MODES } from "@/lib/player/anime4k-modes";
import { moreMenuRows, type MoreMenuAction, type MoreMenuRow } from "@/lib/player/more-menu-rows";
import { watchEscape, watchOutsideMouseDown } from "@/lib/player/overlay-dismiss";
import { SHADER_CATALOG } from "@/lib/player/shader-catalog";
import type { PlayerControlId } from "@/lib/player-chrome";
import { useSettings } from "@/lib/settings";
import { CROP_PRESETS } from "@/views/player/hooks/use-video-fill";
import type { ControlContext } from "./control-renderer";
import { ProgressRing } from "./download-button";
import { Tooltip } from "./tooltip";

const PANEL_CONTROLS: readonly PlayerControlId[] = [
  "chapter-menu",
  "aspect-menu",
  "anime4k-menu",
  "shader-menu",
];

const ROW_ICONS: Record<string, LucideIcon> = {
  chapters: ListTree,
  picture: SlidersHorizontal,
  anime4k: Sparkles,
  shaders: Layers,
  screenshot: Camera,
  "song-id": AudioLines,
  draw: Pencil,
  "draw-clear": Eraser,
  "draw-hide-others": Eye,
};

const DOWNLOAD_ICONS: Partial<Record<MoreMenuAction["kind"], LucideIcon>> = {
  "download-cancel": X,
  "download-reveal": CircleCheck,
  "download-reset": TriangleAlert,
};

function rowIcon(row: MoreMenuRow): LucideIcon {
  return ROW_ICONS[row.key] ?? DOWNLOAD_ICONS[row.action.kind] ?? Download;
}

/**
 * One button for the controls a layout keeps off the bar. A row either acts at
 * once or opens that control's own panel, which is mounted here without its
 * button so it behaves exactly as it does on the bar.
 */
export function MoreMenu({
  ctx,
  renderPanel,
}: {
  ctx: ControlContext;
  renderPanel: (control: PlayerControlId, openSignal: number) => ReactNode;
}) {
  const t = useT();
  const { settings } = useSettings();
  const song = useIdentifySong();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<{ control: PlayerControlId | null; signal: number }>({
    control: null,
    signal: 0,
  });
  const wrap = useRef<HTMLDivElement>(null);

  const { setMoreMenuOpen, download, onDownloadReset } = ctx;
  const controls = ctx.moreControls ?? [];
  const holdsDownload = controls.includes("download");

  useEffect(() => {
    setMoreMenuOpen?.(open);
  }, [open, setMoreMenuOpen]);
  useEffect(() => () => setMoreMenuOpen?.(false), [setMoreMenuOpen]);
  useEffect(() => {
    if (!open) return;
    const stopMouse = watchOutsideMouseDown((e) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    });
    // Escape closes the menu; without this the player takes it as "leave".
    const stopKey = watchEscape(() => setOpen(false));
    return () => {
      stopMouse();
      stopKey();
    };
  }, [open]);
  // The download button clears a finished download after a while so the title
  // can be downloaded again. With the button folded in here, this does it.
  const downloadDone = holdsDownload && download?.kind === "done";
  useEffect(() => {
    if (!downloadDone || !onDownloadReset) return;
    const timer = setTimeout(onDownloadReset, 12000);
    return () => clearTimeout(timer);
  }, [downloadDone, onDownloadReset]);

  const crop = CROP_PRESETS.find((m) => m.id === (ctx.cropMode ?? "fit"));
  const anime4k = ANIME4K_MODES.find((m) => m.id === ctx.anime4kMode);
  const rows = moreMenuRows(controls, {
    engine: ctx.engine,
    isLiveChannel: ctx.isLiveChannel,
    hasChapters: ctx.snap.chapters.some((c) => Number.isFinite(c.startSec)),
    canCrop: !!ctx.onCropMode,
    cropLabel: crop && crop.id !== "fit" ? t(crop.label) : null,
    canShade: !!ctx.onAnime4kMode,
    anime4kAvailable: !!ctx.anime4kAvailable,
    anime4kLabel: anime4k ? t(anime4k.label) : null,
    hasInstalledShaders: SHADER_CATALOG.some((e) => settings.playerShaders?.[e.id]?.dir),
    download,
    canDownload: !!(
      ctx.onDownloadStart &&
      ctx.onDownloadCancel &&
      ctx.onDownloadReveal &&
      onDownloadReset
    ),
    showDraw: ctx.showDraw,
    drawMode: ctx.drawMode,
    hideOthersDrawings: ctx.hideOthersDrawings,
    songIdEnabled: song.enabled,
    songIdPending: song.pending,
  });

  if (rows.length === 0 && !ctx.editing) return null;

  const run = (action: MoreMenuAction) => {
    switch (action.kind) {
      case "none":
        return;
      case "panel":
        setPanel((cur) => ({ control: action.control, signal: cur.signal + 1 }));
        break;
      case "screenshot":
        ctx.onScreenshot();
        break;
      case "download-start":
        ctx.onDownloadStart?.();
        break;
      case "download-cancel":
        ctx.onDownloadCancel?.();
        break;
      case "download-reveal":
        ctx.onDownloadReveal?.();
        break;
      case "download-reset":
        onDownloadReset?.();
        break;
      case "song-id":
        void song.identify();
        break;
      case "draw-toggle":
        ctx.onToggleDraw();
        break;
      case "draw-clear":
        ctx.onClearDraw();
        break;
      case "draw-hide-others":
        ctx.onToggleHideOthers();
        break;
    }
    setOpen(false);
  };

  const downloading = holdsDownload && download?.kind === "downloading" ? download : null;
  const downloadFailed = holdsDownload && download?.kind === "error";

  return (
    <div ref={wrap} className="relative">
      <Tooltip label={t("More")} disabled={open}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={t("More")}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-90 motion-reduce:active:scale-100 ${
            open
              ? "bg-white/22 text-white hover:bg-white/30"
              : "text-white/85 hover:bg-white/10 hover:text-white"
          }`}
        >
          {downloading && (
            <ProgressRing ratio={downloading.ratio} indeterminate={!downloading.totalBytes} />
          )}
          <Ellipsis size={22} strokeWidth={1.9} />
          {(downloadDone || downloadFailed) && (
            <span
              aria-hidden
              className={`absolute end-2.5 top-2.5 h-2 w-2 rounded-full ${
                downloadFailed ? "bg-red-300" : "bg-emerald-300"
              }`}
            />
          )}
        </button>
      </Tooltip>
      {open && rows.length > 0 && (
        <div
          role="menu"
          aria-label={t("More")}
          className="mac-menu absolute end-0 bottom-[calc(100%+10px)] z-30 flex w-max min-w-[220px] max-w-[min(320px,calc(100vw-32px))] flex-col rounded-md bg-elevated p-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] animate-menu-pop"
        >
          {rows.map((row, index) => {
            const Icon = rowIcon(row);
            return (
              <Fragment key={row.key}>
                {index > 0 && rows[index - 1].group !== row.group && (
                  <div className="mac-menu-separator my-1 h-px bg-edge-soft" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={row.disabled}
                  onClick={() => run(row.action)}
                  className="mac-menu-item flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-start text-[13px] text-ink transition-colors hover:bg-raised disabled:opacity-60"
                >
                  <span className={`shrink-0 ${row.active ? "text-accent" : "text-ink-muted"}`}>
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t(row.label)}</span>
                  {row.detail && (
                    <span className="max-w-[120px] shrink-0 truncate tabular-nums text-ink-subtle">
                      {row.detail}
                    </span>
                  )}
                  {row.action.kind === "panel" && (
                    <ChevronRight size={14} strokeWidth={2} className="shrink-0 text-ink-subtle" />
                  )}
                </button>
              </Fragment>
            );
          })}
        </div>
      )}
      {!ctx.editing &&
        PANEL_CONTROLS.filter((control) => controls.includes(control)).map((control) => (
          <Fragment key={control}>
            {renderPanel(control, panel.control === control ? panel.signal : 0)}
          </Fragment>
        ))}
    </div>
  );
}
