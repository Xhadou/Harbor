/**
 * The hero's slide markers on macOS. The marker of the slide on show fills as
 * its time runs, and holds still while the hero is paused. Each marker's
 * button is taller than the bar and the buttons touch, so a click a little off
 * the bar still picks a slide instead of landing on the artwork behind.
 */
export function HeroDots({
  count,
  active,
  period,
  running,
  onPick,
  label,
  className = "",
}: {
  count: number;
  active: number;
  /** Milliseconds a slide stays, or null when slides do not change by themselves. */
  period: number | null;
  running: boolean;
  onPick: (index: number) => void;
  label: (index: number) => string;
  className?: string;
}) {
  return (
    <div data-arrives="" className={`mac-hero-dots ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          data-tv-skip="true"
          onClick={() => onPick(i)}
          aria-label={label(i)}
          aria-current={i === active ? "true" : undefined}
          className="mac-hero-dot"
        >
          <span className="mac-hero-dot-bar">
            {i === active && (
              <span
                className="mac-hero-dot-fill"
                style={
                  period === null
                    ? { animation: "none" }
                    : {
                        animationDuration: `${period}ms`,
                        animationPlayState: running ? "running" : "paused",
                      }
                }
              />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
