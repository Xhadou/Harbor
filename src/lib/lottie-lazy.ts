import type { LottiePlayer } from "lottie-web";

let loading: Promise<LottiePlayer> | null = null;

/**
 * lottie-web is 650 kB and nothing on the first screen animates with it, so it stays out of
 * the launch script and arrives on first use. main.tsx warms it once the app is idle, so a
 * loader that appears later starts at once.
 */
export function loadLottie(): Promise<LottiePlayer> {
  loading ??= import("lottie-web").then((module) => module.default);
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
