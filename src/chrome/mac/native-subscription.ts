type Release = () => void;

/**
 * Registers a listener whose registration is asynchronous and returns a
 * function that stops it, whether or not registration has finished.
 *
 * `onReady` runs once the listener is really in place. Anything that makes
 * the other side send an event has to wait for it: asked earlier, the reply
 * can arrive before anyone is listening and is lost.
 */
export function subscribe<T>(
  register: (handler: (payload: T) => void) => Promise<Release>,
  handler: (payload: T) => void,
  onReady?: () => void,
): () => void {
  let stopped = false;
  let release: Release | null = null;
  void register(handler)
    .then((off) => {
      if (stopped) {
        off();
        return;
      }
      release = off;
      onReady?.();
    })
    .catch((e) => console.warn("[harbor] cannot register a native listener", e));
  return () => {
    stopped = true;
    release?.();
    release = null;
  };
}
