import { useSyncExternalStore } from "react";

// Whether the native toolbar search field is currently the search input. When
// it is not (toolbar hidden, or not on macOS) the overlay keeps its own input.

let active = false;
const listeners = new Set<() => void>();

export function setNativeSearchActive(next: boolean): void {
  if (active === next) return;
  active = next;
  for (const listener of listeners) listener();
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
