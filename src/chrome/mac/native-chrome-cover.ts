// Full-window web layers that the app shell does not know about (the
// screensaver) say here that they are up, so the native sidebar and buttons,
// which float above the web page, get out of their way.

const covering = new Set<string>();
const listeners = new Set<() => void>();

export function nativeChromeCovered(): boolean {
  return covering.size > 0;
}

/** `layer` names the caller, so several layers can overlap without clashing. */
export function setNativeChromeCovered(layer: string, covered: boolean): void {
  const before = nativeChromeCovered();
  if (covered) covering.add(layer);
  else covering.delete(layer);
  if (before === nativeChromeCovered()) return;
  for (const listener of listeners) listener();
}

export function subscribeNativeChromeCovered(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For `useSyncExternalStore`. */
export const nativeChromeCoverStore = [
  subscribeNativeChromeCovered,
  nativeChromeCovered,
  () => false,
] as const;
