import { useSyncExternalStore } from "react";

// Whether the sidebar's native search field is currently the search input.
// That needs both: Harbor offers search on this view, and the sidebar that
// holds the field is on screen. Otherwise the overlay keeps its own input.

const parts = { allowed: false, sidebarShown: false };
let active = false;
const listeners = new Set<() => void>();

export function setNativeSearchParts(next: Partial<typeof parts>): void {
  Object.assign(parts, next);
  const now = parts.allowed && parts.sidebarShown;
  if (active === now) return;
  active = now;
  for (const listener of listeners) listener();
}

/** Whether Harbor offers search on the current view at all, sidebar or not. */
export function searchAllowed(): boolean {
  return parts.allowed;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNativeSearchActive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false,
  );
}
