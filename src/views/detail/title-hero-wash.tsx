import { useEffect, useState } from "react";

/** How long the backdrop takes to fade in over the wash, plus a margin, before the wash is dropped. */
const COVERED_AFTER_MS = 900;

/**
 * The poster as a soft wash of colour behind a title page's top section until
 * its backdrop arrives (macOS). A page that opens out of a card grows as a
 * frame; without this the frame is an empty dark box for as long as the
 * backdrop takes to load, and the growing is not seen at all.
 *
 * `covered` says the backdrop is drawn; the wash is removed once that has
 * faded in, so no blurred layer is kept under a picture that hides it.
 */
export function TitleHeroWash({ src, covered }: { src: string; covered: boolean }) {
  const [drawn, setDrawn] = useState(false);
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    if (!covered) return;
    const id = window.setTimeout(() => setMounted(false), COVERED_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [covered]);
  if (!mounted) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      // The card has just shown this picture, so it is in memory: draw it in the first frame.
      decoding="sync"
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0) setDrawn(true);
      }}
      onLoad={() => setDrawn(true)}
      className="mac-title-wash"
      data-drawn={drawn ? "" : undefined}
    />
  );
}
