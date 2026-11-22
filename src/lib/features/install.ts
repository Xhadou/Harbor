import { invoke } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";
import { HAS_EBOOK, HAS_GAMES, HAS_MANGA, HAS_MUSIC } from "./edition";

export type InstallFeatureKey = "plugins" | "games" | "music" | "ebook" | "manga";
export type InstallFeatures = Record<InstallFeatureKey, boolean>;

// The most this build can offer: a section the edition leaves out stays off whatever the
// native side or a web preview answers.
const ALL_ON: InstallFeatures = {
  plugins: true,
  games: HAS_GAMES,
  music: HAS_MUSIC,
  ebook: HAS_EBOOK,
  manga: HAS_MANGA,
};

function withinEdition(value: Partial<InstallFeatures>): InstallFeatures {
  const merged = { ...ALL_ON, ...value };
  return {
    plugins: merged.plugins,
    games: merged.games && HAS_GAMES,
    music: merged.music && HAS_MUSIC,
    ebook: merged.ebook && HAS_EBOOK,
    manga: merged.manga && HAS_MANGA,
  };
}

let snapshot: InstallFeatures = ALL_ON;
let loading: Promise<void> | null = null;
let ready = false;
const listeners = new Set<() => void>();

export async function readInstallFeatures(): Promise<InstallFeatures> {
  const value = await invoke<Partial<InstallFeatures>>("install_features");
  return withinEdition(value);
}

export function getInstallFeatures(): InstallFeatures {
  loadInstallFeatures();
  return snapshot;
}

function publish(next: InstallFeatures) {
  snapshot = next;
  ready = true;
  listeners.forEach((listener) => listener());
}

/** One read per session. Native availability combines compiled components and the install
 * marker; older builds and web previews retain their existing all-enabled fallback. */
export function loadInstallFeatures(): Promise<void> {
  if (loading) return loading;
  loading = readInstallFeatures()
    .then(publish)
    .catch(() => {
      loading = null; // web preview or an older build: let the next mount try again
      if (!ready) publish(ALL_ON);
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  loadInstallFeatures();
  return () => {
    listeners.delete(listener);
  };
}

export function useInstallFeatures(): InstallFeatures {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => ALL_ON,
  );
}

/** Prevent Music startup work until native component availability is known. */
export function useInstallFeaturesReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => false,
  );
}
