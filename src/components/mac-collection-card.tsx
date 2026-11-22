import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type Ref } from "react";
import { useCardPreview } from "@/components/card-preview/use-card-preview";
import { usePreviewTrailer } from "@/components/card-preview/use-preview-trailer";
import { Play } from "@/components/icons/play-filled";
import { collectionPreview, type CollectionPreview } from "@/lib/card-preview/collection-film";
import { useT } from "@/lib/i18n";
import { smartPlayEpisode } from "@/lib/smart-play";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";

const STANDING_LABEL = {
  start: "Start with",
  next: "Up next",
  again: "Watch again",
} as const;

/**
 * A collection on macOS: its artwork with the name on it at rest. When the
 * pointer rests on it the card widens in its row; the trailer of the next film
 * to watch plays where the artwork is, and the name, the films and Play stand
 * beside it.
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
  const { settings } = useSettings();
  const { openPicker } = useView();
  const sideRef = useRef<HTMLDivElement>(null);
  const preview = useCardPreview(() => {
    const side = sideRef.current;
    return side ? side.offsetLeft + side.offsetWidth : 0;
  });
  const [details, setDetails] = useState<{ id: number; value: CollectionPreview } | null>(null);
  const current = details?.id === collectionId ? details.value : null;

  useEffect(() => {
    if (!preview.wanted || collectionId <= 0 || current) return;
    let cancelled = false;
    void collectionPreview(settings.tmdbKey, collectionId).then((value) => {
      if (!cancelled && value) setDetails({ id: collectionId, value });
    });
    return () => {
      cancelled = true;
    };
  }, [preview.wanted, collectionId, current, settings.tmdbKey]);

  const trailer = usePreviewTrailer({
    meta: current?.film ?? null,
    wanted: preview.wanted,
    open: preview.open,
  });

  const films = current?.count ?? count;
  const facts = [films != null ? t("{count} films", { count: films }) : null, current?.years]
    .filter(Boolean)
    .join(" · ");
  const art = backdrop?.replace("/t/p/original/", "/t/p/w780/");

  return (
    <div
      ref={cardRef}
      data-open={preview.open ? "true" : undefined}
      data-playing={trailer.showing ? "true" : undefined}
      onContextMenu={onContextMenu}
      className="mac-card mac-pv"
      style={{ background }}
      {...preview.handlers}
    >
      {art && (
        <div
          aria-hidden
          className="mac-pv-wash"
          style={{ "--mac-pv-art": `url("${art}")` } as CSSProperties}
        />
      )}
      <div className="mac-pv-media">
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
        <div ref={trailer.slot} aria-hidden className="mac-pv-video" />
        <div className="mac-pv-label">
          <h3>{name}</h3>
          <p>{films != null ? t("{count} films", { count: films }) : t("Collection")}</p>
        </div>
      </div>
      <button type="button" aria-label={name} onClick={onOpen} className="mac-pv-hit" />
      <div ref={sideRef} className="mac-pv-side" inert={!preview.open}>
        <h3 className="mac-pv-title">{name}</h3>
        {facts && <p className="mac-pv-facts">{facts}</p>}
        {current && (
          <p className="mac-pv-next">
            <span>{t(STANDING_LABEL[current.standing])}</span> {current.film.name}
          </p>
        )}
        <div className="mac-pv-actions">
          {current && (
            <button
              type="button"
              onClick={() => openPicker(current.film, smartPlayEpisode(current.film))}
              aria-label={t("Play {name}", { name: current.film.name })}
              className="mac-btn mac-btn-onart inline-flex"
            >
              <Play size={11} fill="currentColor" />
              {t("Play")}
            </button>
          )}
          <button
            type="button"
            onClick={onOpen}
            className="mac-btn mac-btn-onart-quiet inline-flex"
          >
            {t("All films")}
          </button>
        </div>
      </div>
      {trailer.present && (
        <button
          type="button"
          onClick={trailer.toggleMuted}
          aria-label={trailer.muted ? t("Unmute") : t("Mute")}
          className="mac-pv-sound"
        >
          {trailer.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
    </div>
  );
}
