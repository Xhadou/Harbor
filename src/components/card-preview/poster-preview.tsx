import { Volume2, VolumeX } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { heroFacts } from "@/lib/hero-facts";
import { useT } from "@/lib/i18n";
import { getQualityHint } from "@/lib/trailer";
import { usePreviewTrailer } from "./use-preview-trailer";

/**
 * What an opened poster shows over its wide picture: the trailer, the title
 * and one line of facts. It lives inside the card's own button, so it is made
 * of spans and its sound control is not a button of its own.
 */
export function PosterPreview({
  meta,
  wanted,
  open,
}: {
  meta: Meta;
  wanted: boolean;
  open: boolean;
}) {
  const t = useT();
  const trailer = usePreviewTrailer({ meta, wanted, open, quality: getQualityHint() });
  const facts = heroFacts(meta).join(" · ");
  return (
    <span
      data-open={open ? "true" : undefined}
      data-playing={trailer.showing ? "true" : undefined}
      className="mac-pp"
    >
      <span ref={trailer.slot} aria-hidden className="mac-pv-video" />
      <span className="mac-pp-text">
        <span className="mac-pp-title">{meta.name}</span>
        {facts && <span className="mac-pp-facts">{facts}</span>}
      </span>
      {trailer.present && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            trailer.toggleMuted();
          }}
          aria-label={trailer.muted ? t("Unmute") : t("Mute")}
          className="mac-pv-sound"
        >
          {trailer.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </span>
      )}
    </span>
  );
}
