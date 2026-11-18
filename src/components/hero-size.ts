/**
 * Height of the full-bleed hero: 78% of the window. `--mac-vh` is the viewport
 * unit that ignores the hero's own zoom on macOS (see `.mac-zoom-fixed` in
 * index.css); everywhere else it is unset and this is plain `78vh`.
 */
export const HERO_FULL_HEIGHT = "h-[calc(78*var(--mac-vh,1vh))]";
