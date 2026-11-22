/**
 * Resolves when the pictures on the first screen have arrived, so the launch splash can
 * lift onto a finished page instead of one that is still filling in.
 *
 * "Arrived" is every image inside the window being loaded (or having failed) on two frames
 * in a row, once at least one image exists. `capMs` bounds the wait: a slow or absent
 * network must not hold the app behind its splash.
 */
export function firstScreenPainted(capMs: number): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    let settledFrames = 0;
    const check = () => {
      if (performance.now() - started >= capMs) return resolve();
      const { innerWidth, innerHeight } = window;
      let seen = 0;
      let pending = 0;
      for (const image of document.images) {
        if (!image.currentSrc && !image.src) continue;
        const box = image.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth)
          continue;
        seen += 1;
        if (!image.complete) pending += 1;
      }
      settledFrames = seen > 0 && pending === 0 ? settledFrames + 1 : 0;
      if (settledFrames >= 2) return resolve();
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}
