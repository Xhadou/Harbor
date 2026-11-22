import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useCardPreviewOn } from "./use-card-preview";
import { usePreviewTrailer } from "./use-preview-trailer";

export type PreviewAction = { label: string; onClick: () => void; disabled?: boolean };

/**
 * The preview a wide card opens into, for a card that keeps its own artwork
 * and markup: the panel lies over the card, plays the trailer over its
 * artwork and stands the title, a line of facts and the actions beside it.
 * It draws nothing unless its row opens cards (see `Row`'s `previews`), and
 * listens on the element it is placed in.
 */
export function CardPreviewPanel({
  meta,
  art,
  title,
  facts,
  description,
  play,
  more,
}: {
  meta: Meta | null;
  /** The card's artwork, blurred behind the text. */
  art?: string | null;
  title: string;
  facts?: string;
  description?: string;
  /** The filled button, drawn with the play glyph. */
  play?: PreviewAction;
  more?: PreviewAction;
}) {
  const t = useT();
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const [side, setSide] = useState<HTMLDivElement | null>(null);
  const measure = useCallback(() => (side ? side.offsetLeft + side.offsetWidth : 0), [side]);
  const preview = useCardPreviewOn(panel?.parentElement ?? null, measure);
  const trailer = usePreviewTrailer({ meta, wanted: preview.wanted, open: preview.open });
  if (!preview.enabled) return null;

  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  let wash: ReactNode = null;
  if (art) {
    const style = { "--mac-pv-art": `url("${art}")` } as CSSProperties;
    wash = <div aria-hidden className="mac-pv-wash" style={style} />;
  }

  return (
    <div
      ref={setPanel}
      data-open={preview.open ? "true" : undefined}
      data-playing={trailer.showing ? "true" : undefined}
      className="mac-card mac-pv mac-pv-over"
    >
      {wash}
      <div className="mac-pv-media">
        <div ref={trailer.slot} aria-hidden className="mac-pv-video" />
      </div>
      <div ref={setSide} className="mac-pv-side" inert={!preview.open}>
        <h3 className="mac-pv-title">{title}</h3>
        {facts && <p className="mac-pv-facts">{facts}</p>}
        {description && <p className="mac-pv-about">{description}</p>}
        {(play || more) && (
          <div className="mac-pv-actions">
            {play && (
              <button
                type="button"
                onClick={stop(play.onClick)}
                disabled={play.disabled}
                className="mac-btn mac-btn-onart inline-flex"
              >
                <Play size={11} fill="currentColor" />
                {play.label}
              </button>
            )}
            {more && (
              <button
                type="button"
                onClick={stop(more.onClick)}
                disabled={more.disabled}
                className="mac-btn mac-btn-onart-quiet inline-flex"
              >
                {more.label}
              </button>
            )}
          </div>
        )}
      </div>
      {trailer.present && (
        <button
          type="button"
          onClick={stop(trailer.toggleMuted)}
          aria-label={trailer.muted ? t("Unmute") : t("Mute")}
          className="mac-pv-sound"
        >
          {trailer.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
    </div>
  );
}
