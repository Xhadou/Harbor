// What this build carries. The Mac edition leaves four sections out of the app
// altogether (vite.config.ts decides which build that is); every other build,
// and the test runner, carries everything.
//
// These are plain constants on purpose. The bundler folds a condition on one of
// them, so a section that is off takes its code and its artwork out of the
// build, where a setting read at run time would only hide it.
const lean = typeof __HARBOR_LEAN_EDITION__ !== "undefined" && __HARBOR_LEAN_EDITION__;

export const HAS_GAMES = !lean;
export const HAS_MUSIC = !lean;
export const HAS_MANGA = !lean;
export const HAS_EBOOK = !lean;
/** The looks other than the default one, with their artwork and seasonal pages. */
export const HAS_THEMES = !lean;
