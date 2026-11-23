import { useCallback, useEffect, useRef, useState, type MouseEvent, type Ref } from "react";
import { PosterPreview, PosterPreviewUnder } from "@/components/card-preview/poster-preview";
import { CardPreviewPanel } from "@/components/card-preview/preview-panel";
import { useCardPreview } from "@/components/card-preview/use-card-preview";
import { ExpandingCardArtwork, layoutHeight } from "@/components/pick-card/use-expanding-card";
import { Poster } from "@/components/poster";
import { useRowCardExpansion } from "@/components/row-card-expansion";
import { collectionPreview, type CollectionPreview } from "@/lib/card-preview/collection-film";
import { useT } from "@/lib/i18n";
import { expandedCardWidth } from "@/lib/poster-backdrop-expansion";
import { smartPlayEpisode } from "@/lib/smart-play";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";

/** What a collection's preview shows and plays, looked up once the card is wanted. */
function useCollectionDetails(wanted: boolean, collectionId: number): CollectionPreview | null {
  const { settings } = useSettings();
  const [details, setDetails] = useState<{ id: number; value: CollectionPreview } | null>(null);
  const current = details?.id === collectionId ? details.value : null;

  useEffect(() => {
    if (!wanted || collectionId <= 0 || current) return;
    let cancelled = false;
    void collectionPreview(settings.tmdbKey, collectionId).then((value) => {
      if (!cancelled && value) setDetails({ id: collectionId, value });
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, collectionId, current, settings.tmdbKey]);

  return current;
}

/** "8 films · 2001–2015", as far as it is known. */
function useCollectionFacts(count: number | null, details: CollectionPreview | null): string {
  const t = useT();
  const films = details?.count ?? count;
  return [films != null ? t("{count} films", { count: films }) : t("Collection"), details?.years]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A collection in a row on macOS: a poster like the titles in the rows around
 * it, with its name and its number of films under it. It lifts and opens as a
 * title's poster does: onto its wide picture, where the trailer of the next
 * film to watch plays, with Play and All films at the end of the lines under it.
 */
export function MacCollectionPoster({
  cardRef,
  name,
  count,
  poster,
  backdrop,
  collectionId,
  onOpen,
  onContextMenu,
}: {
  cardRef: Ref<HTMLButtonElement>;
  name: string;
  count: number | null;
  poster: string | null;
  backdrop: string | null;
  collectionId: number;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { openPicker } = useView();
  const row = useRowCardExpansion();
  const frame = useRef<HTMLDivElement>(null);
  const wide = backdrop?.replace("/t/p/original/", "/t/p/w1280/");
  // The wide picture the card opens onto: asked for when the card is first wanted, kept after.
  const [wideAsked, setWideAsked] = useState(false);
  const wideOnScreen = useRef<string | null>(null);
  // How wide the card opens, or 0 while its wide picture is not on screen yet.
  const measure = useCallback(() => {
    const node = frame.current;
    if (!node || !wide || wideOnScreen.current !== wide) return 0;
    return expandedCardWidth(layoutHeight(node));
  }, [wide]);
  const preview = useCardPreview(measure, collectionId > 0);
  if (preview.wanted && !wideAsked) setWideAsked(true);
  const details = useCollectionDetails(preview.wanted, collectionId);
  const facts = useCollectionFacts(count, details);
  const film = details?.film ?? null;
  const play = film ? () => openPicker(film, smartPlayEpisode(film)) : undefined;
  const allFilms = t("All films");

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onFocus={preview.handlers.onFocus}
      onBlur={preview.handlers.onBlur}
      onPointerEnter={preview.handlers.onPointerEnter}
      onPointerLeave={preview.handlers.onPointerLeave}
      data-media-card
      data-expanding-card={row?.enabled ? "" : undefined}
      data-row-card-expanded={row?.expanded ? "true" : undefined}
      data-pv-closing={preview.closing ? "" : undefined}
      className="mac-lift group relative z-0 flex w-full min-w-0 flex-col gap-2.5 text-start hover:z-[2]"
    >
      <div
        ref={frame}
        data-preview-anchor
        className={`relative w-full ${row?.enabled ? "expanding-card-poster-frame" : ""}`}
      >
        <Poster
          src={poster ?? undefined}
          seed={`collection:${collectionId}:${name}`}
          ratio="portrait"
          lazy="release"
          className="harbor-card-ring rounded-[var(--poster-radius,12px)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          <ExpandingCardArtwork
            src={wideAsked ? wide : undefined}
            onReady={(url) => {
              wideOnScreen.current = url;
            }}
            onError={() => {
              wideOnScreen.current = null;
            }}
          />
        </Poster>
        {preview.present && (
          <PosterPreview
            meta={film}
            title={name}
            facts={facts}
            wanted={preview.wanted}
            open={preview.open}
            foot={settings.hidePosterTitles}
            onPlay={play}
            onMore={onOpen}
            moreLabel={allFilms}
          />
        )}
      </div>
      {!settings.hidePosterTitles && (
        <div className="mac-card-under min-h-9">
          <p
            style={{ fontSize: `${15 * settings.cardTitleScale}px` }}
            className="mac-card-title line-clamp-1 text-[13px] font-medium leading-snug text-ink"
          >
            {name}
          </p>
          <div className="mac-under-second">
            <p className="mac-card-caption">{facts}</p>
            {preview.present && (
              <span
                className="mac-card-caption mac-under-facts"
                data-open={preview.open ? "true" : undefined}
              >
                {facts}
              </span>
            )}
          </div>
          {preview.present && (
            <PosterPreviewUnder
              open={preview.open}
              onPlay={play}
              onMore={onOpen}
              moreLabel={allFilms}
            />
          )}
        </div>
      )}
    </button>
  );
}

/**
 * A collection in a grid on macOS: its artwork, with its name and its films in the lines
 * under it. When the pointer rests on it, the trailer of the next film to
 * watch plays where the artwork is, and Play and All films come up at the end
 * of those lines.
 */
export function MacCollectionCard({
  cardRef,
  name,
  count,
  backdrop,
  background,
  collectionId,
  onOpen,
  onContextMenu,
}: {
  cardRef: Ref<HTMLDivElement>;
  name: string;
  count: number | null;
  backdrop: string | null;
  background: string;
  collectionId: number;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent) => void;
}) {
  const t = useT();
  const { openPicker } = useView();
  const [wanted, setWanted] = useState(false);
  const current = useCollectionDetails(wanted, collectionId);
  const facts = useCollectionFacts(count, current);
  const art = backdrop?.replace("/t/p/original/", "/t/p/w780/");
  const film = current?.film;

  return (
    <div
      ref={cardRef}
      onContextMenu={onContextMenu}
      className="mac-lift group relative w-full min-w-0"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={name}
        className="mac-card mac-cw-art relative block aspect-video w-full overflow-hidden outline-none"
        style={{ background }}
      >
        {art && (
          <img
            src={art}
            alt=""
            loading="lazy"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 data-[on=true]:opacity-100"
            onLoad={(e) => e.currentTarget.setAttribute("data-on", "true")}
          />
        )}
      </button>
      <p className="mac-card-title mt-2.5 truncate text-[13px] font-medium text-ink">{name}</p>
      <p className="mac-cw-caption">
        <span className="truncate">{facts}</span>
      </p>
      <CardPreviewPanel
        meta={film ?? null}
        onWanted={() => setWanted(true)}
        play={
          film
            ? { label: t("Play"), onClick: () => openPicker(film, smartPlayEpisode(film)) }
            : undefined
        }
        more={{ label: t("All films"), onClick: onOpen }}
      />
    </div>
  );
}
