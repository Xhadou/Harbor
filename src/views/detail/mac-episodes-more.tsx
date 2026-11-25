import { SoftDiv } from "@/components/soft-swap";
import { Check, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HoverTooltip } from "@/components/hover-tooltip";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import type { Season } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { pickRandomEpisode } from "./random-episode-button";

type Layout = "list" | "strip" | "grid";
type Sort = "oldest" | "newest";

const MENU_WIDTH = 232;

/**
 * The episodes toolbar's More menu on macOS. The bar keeps what is used on
 * every visit (search, the season) and this holds the rest: how the list is
 * laid out and ordered, marking the season, a random episode.
 */
export function MacEpisodesMore({
  meta,
  seasons,
  layout,
  onLayout,
  sort,
  onSort,
  allWatched,
  onMarkSeason,
}: {
  meta: Meta;
  seasons: Season[];
  layout: Layout;
  onLayout: (v: Layout) => void;
  /** Absent when the list is in an order of its own (an alternative ordering). */
  sort?: Sort;
  onSort?: (v: Sort) => void;
  allWatched?: boolean;
  onMarkSeason?: (watched: boolean) => void;
}) {
  const t = useT();
  const { openPicker } = useView();
  const { settings } = useSettings();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

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

  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenu({
      x: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      y: Math.min(r.bottom + 8, window.innerHeight - 160),
    });
  };
  const pick = (run: () => void) => () => {
    run();
    setMenu(null);
  };
  const random = () => {
    const episode = pickRandomEpisode(seasons);
    if (!episode) return;
    openPicker(meta, episode, { autoPlay: settings.instantPlay || settings.seasonSourceLock });
  };

  const layouts: { key: Layout; label: string }[] = [
    { key: "list", label: t("List view") },
    { key: "strip", label: t("Horizontal view") },
    { key: "grid", label: t("Grid view") },
  ];
  const sorts: { key: Sort; label: string }[] = [
    { key: "oldest", label: t("Oldest") },
    { key: "newest", label: t("Newest") },
  ];

  return (
    <>
      <HoverTooltip label={t("More actions")} align="center" disabled={!!menu} className="shrink-0">
        <button
          ref={btnRef}
          type="button"
          aria-label={t("More actions")}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => (menu ? setMenu(null) : open())}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-ink-muted transition-colors hover:bg-white/[0.10] hover:text-ink"
        >
          <MoreHorizontal size={17} strokeWidth={2} />
        </button>
      </HoverTooltip>
      {menu &&
        createPortal(
          <SoftDiv
            role="menu"
            style={{ left: menu.x, top: menu.y, width: MENU_WIDTH }}
            onMouseDown={(e) => e.stopPropagation()}
            className="mac-menu fixed z-[320] flex flex-col rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
          >
            {layouts.map((o) => (
              <Row
                key={o.key}
                label={o.label}
                checked={layout === o.key}
                onClick={pick(() => onLayout(o.key))}
              />
            ))}
            {sort && onSort && (
              <>
                <div className="mac-menu-separator my-1 h-px bg-edge-soft" />
                {sorts.map((o) => (
                  <Row
                    key={o.key}
                    label={o.label}
                    checked={sort === o.key}
                    onClick={pick(() => onSort(o.key))}
                  />
                ))}
              </>
            )}
            <div className="mac-menu-separator my-1 h-px bg-edge-soft" />
            {onMarkSeason && (
              <Row
                label={allWatched ? t("Mark season as unwatched") : t("Mark season as watched")}
                onClick={pick(() => onMarkSeason(!allWatched))}
              />
            )}
            <Row label={t("Play a random episode")} onClick={pick(random)} />
          </SoftDiv>,
          document.body,
        )}
    </>
  );
}

function Row({
  label,
  checked,
  onClick,
}: {
  label: string;
  /** Present on a row that is one of a set; true on the one in use. */
  checked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={checked}
      onClick={onClick}
      className="mac-menu-item flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] text-ink transition-colors hover:bg-raised"
    >
      <span className="flex w-3.5 shrink-0 justify-center text-ink-muted">
        {checked && <Check size={13} strokeWidth={2.6} />}
      </span>
      {label}
    </button>
  );
}
