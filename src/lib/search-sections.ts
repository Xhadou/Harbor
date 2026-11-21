/**
 * macOS: search and its shortcuts leave out a place the sidebar does not show,
 * so hiding Music from the sidebar also takes Music out of the results. Other
 * platforms keep searching everything.
 */
export function placeShownForSearch(
  navId: string,
  hiddenNav: readonly string[],
  mac: boolean,
): boolean {
  return !mac || !hiddenNav.includes(navId);
}
