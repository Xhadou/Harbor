import { useMemo } from "react";
import { HeroCarousel, type Slide } from "@/components/hero-carousel";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";

/** A page can feature hundreds of titles (Anime does); the hero turns over the first few. */
const MAX_SLIDES = 8;

/**
 * The hero of a macOS browse page: Home's, fed the page's featured titles.
 * It sits first inside the page's padded column and runs to the window's top
 * and side edges; `pull` cancels the column's top padding (`-mt-28` under
 * `pt-28`). Anything a page pins over its hero goes in as children.
 */
export function MacPageHero({
  metas,
  pull,
  playOpensTitle = false,
  children,
}: {
  metas: Meta[];
  pull: string;
  playOpensTitle?: boolean;
  children?: React.ReactNode;
}) {
  const { settings } = useSettings();
  const slides = useMemo<Slide[]>(
    () => metas.slice(0, MAX_SLIDES).map((meta) => ({ meta })),
    [metas],
  );
  return (
    <div data-scroll-anchor="hero" className={`mac-page-hero harbor-hero-full relative ${pull}`}>
      <HeroCarousel
        slides={slides}
        full
        fullQuality={settings.heroFullQuality}
        bottomAlign
        playOpensTitle={playOpensTitle}
      />
      {children}
    </div>
  );
}
