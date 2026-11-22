import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useCardPreviewOn } from "./use-card-preview";
import { usePreviewTrailer } from "./use-preview-trailer";

export type PreviewAction = { label: string; onClick: () => void; disabled?: boolean };

/**
 * The preview of a wide card, one that keeps its own artwork and names itself
 * in the lines under it: the trailer plays over the artwork, which carries only
 * the trailer's sound control, and the actions come up at the far end of those
 * lines. The card keeps its width. It draws nothing unless its row opens cards
 * (see `Row`'s `previews`), and listens on the element it is placed in, which
 * must be positioned and hold the artwork at its top.
 */
export function CardPreviewPanel({
  meta,
  play,
  more,
  onWanted,
}: {
  /** The title whose trailer plays; null while it is not known yet. */
  meta: Meta | null;
  /** The filled button, drawn with the play glyph. */
  play?: PreviewAction;
  more?: PreviewAction;
  /** The pointer has come to rest on the card: time to fetch what the preview needs. */
  onWanted?: () => void;
}) {
  const t = useT();
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  // The card opens in place: it is asked for the width it already has.
  const measure = useCallback(() => panel?.offsetWidth ?? 0, [panel]);
  const preview = useCardPreviewOn(panel?.parentElement ?? null, measure);
  const trailer = usePreviewTrailer({ meta, wanted: preview.wanted, open: preview.open });
  const wanted = preview.wanted;
  useEffect(() => {
    if (wanted) onWanted?.();
    // Told once each time the card becomes wanted, whatever function the card passes this render.
  }, [wanted]);
  if (!preview.enabled) return null;

  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };

  return (
    <>
      <div
        ref={setPanel}
        data-live={preview.present ? "true" : undefined}
        data-open={preview.open ? "true" : undefined}
        data-playing={trailer.showing ? "true" : undefined}
        className="mac-card mac-pv mac-pv-over"
      >
        <div className="mac-pv-media">
          <div ref={trailer.slot} aria-hidden className="mac-pv-video" />
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
      {(play || more) && (
        <div
          className="mac-pv-under"
          data-open={preview.open ? "true" : undefined}
          inert={!preview.open}
        >
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
              className="mac-btn mac-btn-secondary inline-flex"
            >
              {more.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * A wide card that opens sideways and plays nothing: the card widens in its
 * row, its artwork keeps its place and dissolves at its far edge into a blurred
 * copy of itself, and the title, a line of facts, the story and the actions
 * stand there. For a title the person is already watching, which needs no
 * trailer. Placed and enabled like `CardPreviewPanel`.
 */
export function CardSidePanel({
  art,
  title,
  facts,
  description,
  play,
  more,
}: {
  /** The card's artwork, blurred behind the text. */
  art?: string | null;
  title: string;
  facts?: string;
  description?: string;
  /** The filled button, drawn with the play glyph. */
  play?: PreviewAction;
  more?: PreviewAction;
}) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const [side, setSide] = useState<HTMLDivElement | null>(null);
  // The card opens as wide as the far edge of its text.
  const measure = useCallback(() => (side ? side.offsetLeft + side.offsetWidth : 0), [side]);
  const preview = useCardPreviewOn(panel?.parentElement ?? null, measure);
  if (!preview.enabled) return null;

  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };

  return (
    <div
      ref={setPanel}
      data-open={preview.open ? "true" : undefined}
      className="mac-card mac-pv mac-pv-over"
    >
      {art && (
        <div
          aria-hidden
          className="mac-pv-wash"
          style={{ "--mac-pv-art": `url("${art}")` } as CSSProperties}
        />
      )}
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
    </div>
  );
}
