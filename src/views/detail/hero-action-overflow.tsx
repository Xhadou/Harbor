import { ArrowDownToLine, Ban, Bookmark, Check, MoreHorizontal, RotateCw, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import { activeDownloadFor, cancelDownload, useDownloads } from "@/lib/download/downloads-store";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { AddToListMenu } from "@/components/lists/add-to-list-menu";
import { HoverTooltip } from "@/components/hover-tooltip";
import type { ListItemInput } from "@/lib/custom-lists";
import {
  AnilistMenuItems,
  PmdbMenuItems,
  SimklMenuItems,
  TraktMenuItems,
} from "./overflow-sync-items";
import { UiIcon } from "@/components/ui-icon";
import { RatingModal } from "@/components/ratings/rating-modal";
import { ReminderMenu, type ReminderSeed } from "@/components/reminder-button";
import { useRating } from "@/lib/ratings/store";
import { useReminder } from "@/lib/reminders";
import type { RatingTarget } from "@/lib/ratings/types";

const CIRCLES_SAVED_ESTIMATE = 132;

export function useHeroActionOverflow(rowRef: RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);
  const widthsRef = useRef<[number, number]>([0, 0]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const section = row.closest("section");
    const measure = () => {
      const r = rowRef.current;
      const sec = r?.closest("section");
      if (!r || !sec) return;
      const rowRect = r.getBoundingClientRect();
      const secRect = sec.getBoundingClientRect();
      const available = secRect.right - 40 - rowRect.left - 16;
      const cur = stageRef.current;
      if (cur === 0) widthsRef.current[0] = r.scrollWidth;
      if (cur === 1) widthsRef.current[1] = r.scrollWidth;
      const w0 = widthsRef.current[0];
      const w1 = widthsRef.current[1] || (w0 ? Math.max(0, w0 - CIRCLES_SAVED_ESTIMATE) : 0);
      const next = w0 === 0 || w0 <= available ? 0 : w1 <= available ? 1 : 2;
      if (next !== stageRef.current) {
        stageRef.current = next;
        setStage(next);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    if (section) ro.observe(section);
    const mo = new MutationObserver(measure);
    if (section) mo.observe(section, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, deps);

  return stage;
}

export function HeroActionOverflow({
  meta,
  isFav,
  onToggleFavorite,
  hasTrailer,
  onTrailer,
  canDownload,
  showWatched = false,
  onWatched,
  watchedMark = false,
  showSync = false,
  inWatchlist = false,
  onToggleWatchlist,
  listItem = null,
  simkl = null,
  anilist = null,
  pmdb = null,
  canDrop = false,
  onDrop,
  layout = "stock",
  rate = null,
  reminder = null,
}: {
  meta: Meta;
  isFav: boolean;
  onToggleFavorite: () => void;
  hasTrailer: boolean;
  onTrailer: () => void;
  canDownload: boolean;
  showWatched?: boolean;
  onWatched?: () => void;
  watchedMark?: boolean;
  showSync?: boolean;
  inWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  listItem?: ListItemInput | null;
  simkl?: { harborId: string; type: "movie" | "series" } | null;
  anilist?: { harborId: string } | null;
  pmdb?: { harborId: string; type: "movie" | "series" } | null;
  canDrop?: boolean;
  onDrop?: () => void;
  /** "mac": the title page's one More menu. Watchlist stays a button beside
   * it, so it is not repeated here, and the sync services come last. */
  layout?: "stock" | "mac";
  /** Lists rating in the menu, for a row that has no rate button. */
  rate?: RatingTarget | null;
  /** Lists the reminder in the menu, for a row that has no reminder button. */
  reminder?: ReminderSeed | null;
}) {
  const t = useT();
  const { openPicker } = useView();
  useDownloads();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [listMenu, setListMenu] = useState(false);
  const [rating, setRating] = useState(false);
  const [reminderMenu, setReminderMenu] = useState(false);
  const score = useRating(rate?.itemKey ?? "")?.score ?? 0;
  const reminderOn = !!useReminder(reminder?.id ?? "");
  const mac = layout === "mac";

  const dl = canDownload ? activeDownloadFor(meta.id, null, null) : null;
  const downloading = dl?.status === "downloading";
  const done = dl?.status === "done";
  const failed = dl?.status === "error";
  const pct = Math.round((dl?.ratio ?? 0) * 100);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenu({
      x: Math.max(8, Math.min(r.left, window.innerWidth - 240)),
      y: Math.min(r.bottom + 8, window.innerHeight - 160),
    });
  };

  const syncItems = (
    <>
      {simkl && (
        <SimklMenuItems
          harborId={simkl.harborId}
          type={simkl.type}
          onAction={() => setMenu(null)}
        />
      )}
      {anilist && <AnilistMenuItems harborId={anilist.harborId} onAction={() => setMenu(null)} />}
      {pmdb && (
        <PmdbMenuItems harborId={pmdb.harborId} type={pmdb.type} onAction={() => setMenu(null)} />
      )}
      <TraktMenuItems
        harborId={meta.id}
        type={meta.type === "series" ? "series" : "movie"}
        onAction={() => setMenu(null)}
      />
    </>
  );

  return (
    <>
      <HoverTooltip label={t("More actions")} align="center" disabled={!!menu} className="shrink-0">
        <button
          ref={btnRef}
          type="button"
          aria-label={t("More actions")}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => (menu ? setMenu(null) : openMenu())}
          className={
            mac
              ? "mac-btn mac-btn-lg mac-btn-onart-quiet mac-btn-icon relative flex shrink-0"
              : "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-canvas/80 text-ink transition-[transform,background-color] duration-200 hover:bg-canvas/95 active:scale-[0.94]"
          }
        >
          <MoreHorizontal size={mac ? 16 : 20} strokeWidth={1.9} />
          {isFav && !mac && (
            <span className="absolute end-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </button>
      </HoverTooltip>
      {menu &&
        createPortal(
          <div
            role="menu"
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            className="mac-menu fixed z-[320] flex max-h-[min(70vh,480px)] w-[224px] flex-col overflow-y-auto rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
          >
            {showSync && !mac && (
              <>
                <Item
                  icon={
                    inWatchlist ? (
                      <Check size={14} strokeWidth={2.4} />
                    ) : (
                      <Bookmark size={14} strokeWidth={2} />
                    )
                  }
                  label={inWatchlist ? t("In Watchlist") : t("Add to Watchlist")}
                  active={inWatchlist}
                  onClick={() => {
                    onToggleWatchlist?.();
                    setMenu(null);
                  }}
                />
                {syncItems}
                <div className="mac-menu-separator my-1 h-px bg-edge-soft" />
              </>
            )}
            {rate && (
              <Item
                icon={<UiIcon name="rate" className="h-3.5 w-3.5" />}
                label={score ? t("Your rating {n}/10", { n: score }) : t("Rate this")}
                active={score > 0}
                onClick={() => {
                  setMenu(null);
                  setRating(true);
                }}
              />
            )}
            <Item
              icon={
                isFav ? (
                  <UiIcon name="unfavorite" className="h-3.5 w-3.5" />
                ) : (
                  <UiIcon name="favorite" className="h-3.5 w-3.5" />
                )
              }
              label={isFav ? t("Favorited") : t("Favorite")}
              active={isFav}
              onClick={() => {
                onToggleFavorite();
                setMenu(null);
              }}
            />
            {listItem && (
              <Item
                icon={<UiIcon name="list" className="h-3.5 w-3.5" />}
                label={t("Add to list")}
                onClick={() => {
                  setMenu(null);
                  setListMenu(true);
                }}
              />
            )}
            {showWatched && (
              <Item
                icon={
                  watchedMark ? (
                    <UiIcon name="mark-unwatched" className="h-3.5 w-3.5" />
                  ) : (
                    <UiIcon name="mark-watched" className="h-3.5 w-3.5" />
                  )
                }
                label={watchedMark ? t("Marked watched") : t("Mark watched")}
                active={watchedMark}
                onClick={() => {
                  onWatched?.();
                  setMenu(null);
                }}
              />
            )}
            {reminder && (
              <Item
                icon={<UiIcon name="remindme" className="h-3.5 w-3.5" />}
                label={reminderOn ? t("Reminder on") : t("Remind me")}
                active={reminderOn}
                onClick={() => {
                  setMenu(null);
                  setReminderMenu(true);
                }}
              />
            )}
            {canDrop && !mac && (
              <Item
                icon={<Ban size={14} strokeWidth={2.1} />}
                label={t("Drop show")}
                danger
                onClick={() => {
                  onDrop?.();
                  setMenu(null);
                }}
              />
            )}
            {hasTrailer && (
              <Item
                icon={<UiIcon name="trailer" className="h-3.5 w-3.5" />}
                label={t("Watch trailer")}
                onClick={() => {
                  onTrailer();
                  setMenu(null);
                }}
              />
            )}
            {canDownload && (
              <Item
                icon={
                  downloading ? (
                    <X size={14} strokeWidth={2.2} />
                  ) : done ? (
                    <Check size={14} strokeWidth={2.4} />
                  ) : failed ? (
                    <RotateCw size={14} strokeWidth={2.2} />
                  ) : (
                    <ArrowDownToLine size={14} strokeWidth={2} />
                  )
                }
                label={
                  downloading
                    ? t("Downloading {pct}%  ·  cancel", { pct })
                    : done
                      ? t("Saved offline")
                      : failed
                        ? t("Retry download")
                        : t("Download for offline")
                }
                active={done}
                onClick={() => {
                  if (downloading && dl) cancelDownload(dl.id);
                  else openPicker(meta, undefined, { intent: "download" });
                  setMenu(null);
                }}
              />
            )}
            {mac && (
              <>
                <div className="mac-menu-separator my-1 h-px bg-edge-soft" />
                {showSync && syncItems}
                {canDrop && (
                  <Item
                    icon={<Ban size={14} strokeWidth={2.1} />}
                    label={t("Drop show")}
                    danger
                    onClick={() => {
                      onDrop?.();
                      setMenu(null);
                    }}
                  />
                )}
              </>
            )}
          </div>,
          document.body,
        )}
      {rate && rating && <RatingModal target={rate} onClose={() => setRating(false)} />}
      {reminder && (
        <ReminderMenu
          seed={reminder}
          anchorRef={btnRef}
          open={reminderMenu}
          onClose={() => setReminderMenu(false)}
        />
      )}
      {listItem && (
        <AddToListMenu
          item={listItem}
          anchorRef={btnRef}
          open={listMenu}
          onClose={() => setListMenu(false)}
        />
      )}
    </>
  );
}

function Item({
  icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`mac-menu-item flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] transition-colors ${
        danger
          ? "text-danger hover:bg-danger/10"
          : active
            ? "text-accent hover:bg-raised"
            : "text-ink hover:bg-raised"
      }`}
    >
      <span className={danger ? "text-danger" : active ? "text-accent" : "text-ink-muted"}>
        {icon}
      </span>
      {label}
    </button>
  );
}
