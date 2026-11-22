import { useEffect, useState, type MouseEvent, type Ref } from "react";
import { CardPreviewPanel } from "@/components/card-preview/preview-panel";
import { collectionPreview, type CollectionPreview } from "@/lib/card-preview/collection-film";
import { useT } from "@/lib/i18n";
import { smartPlayEpisode } from "@/lib/smart-play";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";

/**
 * A collection on macOS: its artwork, with its name and its films in the lines
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
  const { settings } = useSettings();
  const { openPicker } = useView();
  const [wanted, setWanted] = useState(false);
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

  const films = current?.count ?? count;
  const facts = [
    films != null ? t("{count} films", { count: films }) : t("Collection"),
    current?.years,
  ]
    .filter(Boolean)
    .join(" · ");
  const art = backdrop?.replace("/t/p/original/", "/t/p/w780/");
  const film = current?.film;

  return (
    <div ref={cardRef} onContextMenu={onContextMenu} className="group relative w-full min-w-0">
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
      <p className="mt-2.5 truncate text-[13px] font-medium text-ink">{name}</p>
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
