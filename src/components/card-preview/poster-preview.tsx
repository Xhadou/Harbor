import { Volume2, VolumeX } from "lucide-react";
import type { CSSProperties, MouseEvent, Ref } from "react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import { heroFacts } from "@/lib/hero-facts";
import { useT } from "@/lib/i18n";
import { getQualityHint } from "@/lib/trailer";
import { usePreviewTrailer } from "./use-preview-trailer";

/**
 * What an opened poster shows: the same preview a wide card opens into (see
 * `CardPreviewPanel`). The trailer plays over the poster's wide picture, and
 * the title, a line of facts, the story and the actions stand beside it. It
 * lives inside the card's own button, so it is made of spans and its controls
 * are not buttons of their own: they take the pointer, and the card itself
 * stays the one thing the keyboard lands on.
 */
export function PosterPreview({
  meta,
  title,
  art,
  wanted,
  open,
  sideRef,
  onPlay,
  onMore,
}: {
  meta: Meta;
  title: string;
  /** The poster's wide picture, blurred behind the text. */
  art?: string;
  wanted: boolean;
  open: boolean;
  /** The text column: the card opens as wide as its far edge. */
  sideRef: Ref<HTMLSpanElement>;
  /** Left out for a title whose episode is picked on its own page. */
  onPlay?: () => void;
  onMore: () => void;
}) {
  const t = useT();
  const trailer = usePreviewTrailer({ meta, wanted, open, quality: getQualityHint() });
  const facts = heroFacts(meta).join(" · ");
  const press = (run: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    run();
  };
  return (
    <span
      data-open={open ? "true" : undefined}
      data-playing={trailer.showing ? "true" : undefined}
      className="mac-card mac-pv mac-pv-over mac-pv-poster"
    >
      {art && (
        <span
          aria-hidden
          className="mac-pv-wash"
          style={{ "--mac-pv-art": `url("${art}")` } as CSSProperties}
        />
      )}
      <span className="mac-pv-media">
        <span ref={trailer.slot} aria-hidden className="mac-pv-video" />
      </span>
      <span ref={sideRef} className="mac-pv-side" inert={!open}>
        <span className="mac-pv-title">{title}</span>
        {facts && <span className="mac-pv-facts">{facts}</span>}
        {meta.description && <span className="mac-pv-about">{meta.description}</span>}
        <span className="mac-pv-actions">
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
            className="mac-btn mac-btn-onart-quiet inline-flex"
          >
            {t("More info")}
          </span>
        </span>
      </span>
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
