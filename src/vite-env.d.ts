/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __IS_BETA_BUILD__: boolean;
declare const __BUILD_ID__: string;
declare const __BUILD_DATE__: string;
/** True in the Mac edition, which ships without Games, Music, Manga, Ebooks and extra themes. */
declare const __HARBOR_LEAN_EDITION__: boolean | undefined;

interface ImportMetaEnv {
  readonly VITE_HARBOR_API_BASE?: string;
  readonly VITE_HARBOR_BUGS_BASE?: string;
  readonly VITE_HARBOR_SYNC_BASE?: string;
  readonly VITE_HARBOR_RELAY_BASE?: string;
  readonly VITE_HARBOR_TRAKT_BASE?: string;
  readonly VITE_HARBOR_MAL_BASE?: string;
  readonly VITE_HARBOR_TVDB_BASE?: string;
}

interface Window {
  __harborStremioDeeplink?: boolean;
  __harborInstallerOpen?: boolean;
}
