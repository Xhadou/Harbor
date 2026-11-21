import { Play } from "@/components/icons/play-filled";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { RtBadge } from "@/components/rt-badge";
import { useT } from "@/lib/i18n";

/**
 * What sits under a hero's title on macOS: one line of facts with the scores
 * beside it, then the actions. Play starts the title and "More info" opens its
 * page; a hero that cannot start its title offers the page alone.
 */
export function MacHeroFoot({
  facts,
  imdbRating,
  rtCritics,
  onPlay,
  onInfo,
  onOverControls,
}: {
  facts: string[];
  imdbRating?: string | null;
  rtCritics?: number | null;
  /** Absent when the title cannot be started from the hero. */
  onPlay?: () => void;
  onInfo: () => void;
  onOverControls: (over: boolean) => void;
}) {
  const t = useT();
  const act = (run: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    run();
  };
  return (
    <>
      <div className="mac-hero-facts flex flex-wrap items-center">
        {facts.length > 0 && <span>{facts.join(" · ")}</span>}
        {imdbRating && (
          <span className="flex items-center gap-1.5">
            <ImdbIcon className="h-[14px] w-auto rounded-[3px]" />
            <span className="mac-hero-score">{imdbRating}</span>
          </span>
        )}
        {rtCritics != null && (
          <span className="flex items-center gap-1.5">
            <RtBadge score={rtCritics} className="h-[14px] w-auto" />
            <span className="mac-hero-score">{rtCritics}%</span>
          </span>
        )}
      </div>
      <div
        className="mac-hero-actions flex"
        onMouseEnter={() => onOverControls(true)}
        onMouseLeave={() => onOverControls(false)}
      >
        {onPlay ? (
          <>
            <button
              type="button"
              onClick={act(onPlay)}
              className="mac-btn mac-btn-lg mac-btn-onart flex"
            >
              <Play size={13} fill="currentColor" />
              {t("Play")}
            </button>
            <button
              type="button"
              onClick={act(onInfo)}
              className="mac-btn mac-btn-lg mac-btn-onart-quiet flex"
            >
              {t("More info")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={act(onInfo)}
            className="mac-btn mac-btn-lg mac-btn-onart flex"
          >
            {t("View details")}
          </button>
        )}
      </div>
    </>
  );
}
