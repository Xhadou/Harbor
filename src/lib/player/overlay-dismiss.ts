let lastDismiss = 0;

export function noteOverlayDismiss(): void {
  lastDismiss = typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function dismissedJustNow(withinMs = 400): boolean {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  return now - lastDismiss < withinMs;
}

export function clearOverlayDismiss(): void {
  lastDismiss = 0;
}

export function watchOutsideMouseDown(handler: (e: MouseEvent) => void): () => void {
  const wrapped = (e: MouseEvent) => {
    if ((e.target as Element | null)?.closest?.("[data-dropdown-menu]")) return;
    noteOverlayDismiss();
    handler(e);
  };
  window.addEventListener("mousedown", wrapped);
  return () => window.removeEventListener("mousedown", wrapped);
}

/**
 * Closes a player menu on Escape before the player takes the key as "leave
 * playback". A text field that holds text keeps its own Escape handling.
 */
export function watchEscape(close: () => void): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const target = e.target as Element | null;
    // A field with text in it gets the key first (to clear or cancel its own
    // edit). An empty one, like a menu's search box, has nothing to undo.
    const field = target?.closest?.("input, textarea") as HTMLInputElement | null | undefined;
    if (field && field.value !== "") return;
    if (!field && target?.closest?.("select, [contenteditable='true'], [data-dropdown-menu]"))
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    noteOverlayDismiss();
    close();
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
}
