import { Volume2, VolumeX } from "lucide-react";
import { useLayoutEffect, useRef, type MouseEvent } from "react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import { heroFacts } from "@/lib/hero-facts";
import { useT } from "@/lib/i18n";
import { getQualityHint } from "@/lib/trailer";
import { usePreviewTrailer } from "./use-preview-trailer";

/** A click on a control inside the card is the control's, not the card's. */
const press = (run: () => void) => (event: MouseEvent) => {
  event.stopPropagation();
  run();
};

type PreviewActions = {
  /** Left out for a title whose episode is picked on its own page. */
  onPlay?: () => void;
  onMore: () => void;
};

/**
 * What an opened poster shows on its picture: the wide picture with the
 * trailer playing over it, and the trailer's sound control. The title, the
 * facts and the actions stand under the card (`PosterPreviewUnder`), clear of
 * whatever the trailer itself shows. A card with no line under it (`foot`)
 * carries them along the picture's foot instead. It lives inside the card's own
 * button, so it is made of spans and its controls are not buttons of their own:
 * they take the pointer, and the card itself stays the one thing the keyboard
 * lands on.
 */
export function PosterPreview({
  meta,
  title,
  wanted,
  open,
  foot,
  onPlay,
  onMore,
}: PreviewActions & {
  meta: Meta;
  title: string;
  wanted: boolean;
  open: boolean;
  /** The card draws no title under itself: the title and the actions go on the picture. */
  foot: boolean;
}) {
  const t = useT();
  const trailer = usePreviewTrailer({ meta, wanted, open, quality: getQualityHint() });
  const facts = heroFacts(meta).join(" · ");
  return (
    <span
      data-live="true"
      data-open={open ? "true" : undefined}
      data-playing={trailer.showing ? "true" : undefined}
      className="mac-card mac-pv mac-pv-over mac-pv-poster"
    >
      <span className="mac-pv-media">
        <span ref={trailer.slot} aria-hidden className="mac-pv-video" />
      </span>
      {foot && <span aria-hidden className="mac-pv-shade" />}
      {foot && (
        <span className="mac-pv-bar" inert={!open}>
          <span className="mac-pv-who">
            <span className="mac-pv-title">{title}</span>
            {facts && <span className="mac-pv-facts">{facts}</span>}
          </span>
          <span className="mac-pv-actions">
            <PreviewButtons onPlay={onPlay} onMore={onMore} quiet="mac-btn-onart-quiet" />
          </span>
        </span>
      )}
      {trailer.present && (
        <span
          role="button"
          tabIndex={-1}
          onClick={press(trailer.toggleMuted)}
          aria-label={trailer.muted ? t("Unmute") : t("Mute")}
          className="mac-pv-sound"
        >
          {trailer.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </span>
      )}
    </span>
  );
}

function PreviewButtons({ onPlay, onMore, quiet }: PreviewActions & { quiet: string }) {
  const t = useT();
  return (
    <>
      {onPlay && (
        <span
          role="button"
          tabIndex={-1}
          onClick={press(onPlay)}
          className="mac-btn mac-btn-onart inline-flex"
        >
          <Play size={11} fill="currentColor" />
          {t("Play")}
        </span>
      )}
      <span
        role="button"
        tabIndex={-1}
        onClick={press(onMore)}
        className={`mac-btn ${quiet} inline-flex`}
      >
        {t("More info")}
      </span>
    </>
  );
}

/**
 * The actions an opened poster adds under itself, at the far end of the line
 * where its title stands. They are mounted in the card's caption while the
 * preview is present, stand where they will be once the card is open, and are
 * uncovered as it widens. Their width is told to the caption
 * (`--mac-under-acts`), which keeps the title and the facts clear of them.
 */
export function PosterPreviewUnder({ open, onPlay, onMore }: PreviewActions & { open: boolean }) {
  const buttons = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = buttons.current;
    const caption = node?.closest<HTMLElement>(".mac-card-under");
    if (!node || !caption) return;
    caption.style.setProperty("--mac-under-acts", `${node.offsetWidth}px`);
    return () => {
      caption.style.removeProperty("--mac-under-acts");
    };
  }, []);
  return (
    <span className="mac-under-acts" data-open={open ? "true" : undefined} inert={!open}>
      <span ref={buttons} className="mac-under-btns">
        <PreviewButtons onPlay={onPlay} onMore={onMore} quiet="mac-btn-secondary" />
      </span>
    </span>
  );
}
