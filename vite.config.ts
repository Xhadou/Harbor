import { readdirSync, readFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { defineConfig, type Plugin, type ViteDevServer, type HttpProxy } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

declare const process: { env: Record<string, string | undefined>; platform: string };

function silenceMediapipeSourcemap() {
  return {
    name: "silence-mediapipe-sourcemap",
    enforce: "pre" as const,
    load(id: string) {
      const file = id.split("?")[0];
      if (file.includes("@mediapipe") && file.endsWith(".mjs")) {
        const code = readFileSync(file, "utf-8").replace(/\/\/#\s*sourceMappingURL=[^\n]*/g, "");
        return { code, map: null };
      }
      return null;
    },
  };
}

function servePublicMediapipe() {
  return {
    name: "serve-public-mediapipe",
    apply: "serve" as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!path.startsWith("/mp-wasm/") || path.includes("..") || !path.endsWith(".js")) {
          next();
          return;
        }
        let body: Buffer;
        try {
          body = readFileSync(`${server.config.root}/public${path}`);
        } catch {
          next();
          return;
        }
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(body);
      });
    },
  };
}

// Source that belongs only to the sections the Mac edition leaves out (see
// src/lib/features/edition.ts). lib/manga/plugins stays: stream plugins share its host.
const LEFT_OUT_OF_MAC_EDITION =
  /\/src\/(?:views|lib|components|hooks|assets)\/(?:games|music|ebook|dj|spooktober)\/|\/src\/(?:views|components)\/manga\/|\/src\/lib\/manga\/(?!plugins\/)/;

// Files under public/ that only those sections load, plus three nothing loads at all
// (ort/ is a second copy of what lib/face bundles itself; nosources.png and chest-open.png
// have no reference left). The no-SIMD MediaPipe build is for engines older than any the
// Mac edition runs on.
const PUBLIC_LEFT_OUT_OF_MAC_EDITION = [
  "games",
  "spooktober",
  "pdfjs",
  "flipbook",
  "reader-icons",
  "universe-logos",
  "mangahero.png",
  "manga-paper-boat.png",
  "ebook-hero-open-books.png",
  "ort",
  "nosources.png",
  "chest-open.png",
  "mp-wasm/vision_wasm_nosimd_internal.js",
  "mp-wasm/vision_wasm_nosimd_internal.wasm",
];

// The string tables of those sections, in every language: locales/en/games.ts and the like.
const STRINGS_LEFT_OUT_OF_MAC_EDITION =
  /\/src\/lib\/i18n\/locales\/[a-z]+\/(?:games?|music|ebook|manga|dj)(?:-[a-z0-9-]+)?\.ts$/;

/**
 * Deletes every file in `dir` that nothing in the built output mentions. A file with a
 * hashed name that no script, stylesheet or page names cannot be asked for. It runs on the
 * finished output, not on the bundle in memory: the names of lazily loaded scripts and
 * stylesheets are only written into the scripts that load them at the very end, and a pass
 * made before that takes every such stylesheet for unused. Repeated until nothing more
 * goes, since a worker script that is no longer started is itself such a file, and is the
 * only thing naming the model it would have loaded.
 */
function removeUnmentionedFiles(outDir: string, dir: string): void {
  const readable = /\.(?:m?js|css|html|json)$/;
  const plainName = /^[\w.@~-]+$/;
  const everyFile = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? everyFile(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`],
    );
  for (;;) {
    const texts = everyFile(outDir)
      .filter((file) => readable.test(file))
      .map((file) => readFileSync(file, "utf-8"));
    const mentioned = new Set<string>();
    for (const text of texts) {
      for (const name of text.match(/[\w.@~-]+\.\w+/g) ?? []) mentioned.add(name);
    }
    const unused = readdirSync(dir).filter((name) =>
      // A name with a character the pattern above cannot carry is looked for as it is.
      plainName.test(name) ? !mentioned.has(name) : !texts.some((text) => text.includes(name)),
    );
    if (unused.length === 0) return;
    for (const name of unused) rmSync(`${dir}/${name}`, { recursive: true, force: true });
  }
}

/**
 * Leaves out of the Mac edition what its missing sections would have used: their string
 * tables, the files under public/ only they load, and the pictures and models their code
 * imported. The build writes an imported file to disk when it reads the import, before it
 * knows whether the code around it survives, so dropping the code alone leaves the files.
 */
function macEditionDiet(): Plugin {
  let outDir = "dist";
  let assetsDir = "assets";
  return {
    name: "harbor-mac-edition-diet",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      outDir = config.build.outDir;
      assetsDir = config.build.assetsDir;
    },
    // A language's table is one object spread together from a file per subject. The files
    // for a section that is left out are read as empty, so their text (450 kB in English
    // alone, loaded at launch) is not carried for screens that do not exist.
    load(id) {
      return STRINGS_LEFT_OUT_OF_MAC_EDITION.test(id) ? "export default {};" : null;
    },
    closeBundle() {
      for (const path of PUBLIC_LEFT_OUT_OF_MAC_EDITION) {
        rmSync(`${outDir}/${path}`, { recursive: true, force: true });
      }
      removeUnmentionedFiles(outDir, `${outDir}/${assetsDir}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const android = mode === "android" || process.env.HARBOR_TARGET === "android";
  const devHost = process.env.TAURI_DEV_HOST;
  // The Mac edition ships without Games, Music, Manga, Ebooks and the extra themes
  // (src/lib/features/edition.ts). A build made on a Mac is that edition unless
  // HARBOR_EDITION says otherwise; the native side follows in scripts/tauri.mjs.
  const edition = process.env.HARBOR_EDITION ?? (process.platform === "darwin" ? "mac" : "full");
  const lean = !android && edition === "mac";
  return {
    staged: { "*": "vp check --fix" },
    plugins: [
      react(),
      tailwindcss(),
      silenceMediapipeSourcemap(),
      servePublicMediapipe(),
      ...(lean ? [macEditionDiet()] : []),
    ],
    clearScreen: false,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __HARBOR_LEAN_EDITION__: JSON.stringify(lean),
      __IS_BETA_BUILD__: JSON.stringify(process.env.HARBOR_CHANNEL !== "stable"),
      __BUILD_ID__: JSON.stringify(
        process.env.HARBOR_BUILD_ID ||
          (() => {
            try {
              return execSync("git rev-parse --short HEAD").toString().trim();
            } catch {
              return "local";
            }
          })(),
      ),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    // Both entries ship. index-tv.html is what the TV window loads; index.html
    // exists only so web_server.rs has a page to hand the phone for /remote,
    // which the QR hand-off in onboarding depends on. Listing tv alone left the
    // phone staring at "web assets are not available in this build".
    // Vite 7 defaults to baseline-widely-available, a chrome107 floor. Android
    // TV sticks and Fire TV ship a System WebView well below that, and the
    // failure is a bare SyntaxError before React mounts, with no error surface
    // on a device you cannot open devtools on. Pin a floor the hardware meets.
    // This lowers syntax only; esbuild adds no API polyfills.
    ...(android
      ? {
          build: {
            target: "chrome87",
            rollupOptions: { input: { tv: "index-tv.html", main: "index.html" } },
          },
        }
      : {
          build: {
            rollupOptions: {
              // retro-player.html is the emulator's pop-out window, which is part of Games.
              input: lean
                ? { main: "index.html", tray: "tray.html" }
                : { main: "index.html", retro: "retro-player.html", tray: "tray.html" },
              // In the Mac edition nothing may run on behalf of a section that was left
              // out. Without this, a module of that section that is still imported
              // somewhere keeps whatever it does at load (stores, listeners) and all the
              // code that work reaches, even though none of its exports is used.
              ...(lean
                ? {
                    treeshake: {
                      moduleSideEffects: (id: string) => !LEFT_OUT_OF_MAC_EDITION.test(id),
                    },
                  }
                : {}),
            },
          },
        }),
    server: {
      host: devHost || "127.0.0.1",
      port: 1420,
      strictPort: true,
      ...(devHost ? { hmr: { protocol: "ws", host: devHost, port: 1421 } } : {}),
      watch: {
        ignored: [
          "**/src-tauri/**",
          "**/android-native/**",
          "**/android/**",
          "**/android-extension-compat/**",
          "**/.gradle/**",
          "**/target/**",
          "**/work/**",
          "**/scratchpad/**",
          "**/.firecrawl/**",
          "**/.diag/**",
          "**/_private/**",
          "**/harbor-install-recovery/**",
        ],
      },
      proxy: Object.fromEntries(
        [
          "mcp-api.op.gg",
          "store.steampowered.com",
          "api.steampowered.com",
          "steamcommunity.com",
          "partner.steamgames.com",
          "help.steampowered.com",
          "worldofwarcraft.blizzard.com",
          "api.warframe.com",
          "www.youtube.com",
          "www.pcgamingwiki.com",
          "kick.com",
          "prosettings.net",
          "www.speedrun.com",
          "graphql.anilist.co",
          "openlibrary.org",
          "covers.openlibrary.org",
          "www.googleapis.com",
          "www.wikidata.org",
          "api.deepseek.com",
        ].map((host) => [
          `/api-proxy/${host}`,
          {
            target: `https://${host}`,
            changeOrigin: true,
            ...(["www.youtube.com", "kick.com", "prosettings.net"].includes(host)
              ? {
                  configure(proxy: HttpProxy.ProxyServer) {
                    proxy.on("proxyReq", (request) => {
                      // Public guide fetches are server-to-server, like native Harbor.
                      // Local webview fetch metadata describes our proxy, not the source.
                      for (const name of [
                        "origin",
                        "referer",
                        "sec-fetch-site",
                        "sec-fetch-mode",
                        "sec-fetch-dest",
                      ])
                        request.removeHeader(name);
                    });
                  },
                }
              : {}),
            ...(host === "steamcommunity.com"
              ? {
                  configure(proxy: HttpProxy.ProxyServer) {
                    proxy.on("proxyRes", (response, request) => {
                      // Keep canonical achievement redirects (440 → TF2) inside the dev proxy.
                      if (
                        !/^\/stats\/[^/]+\/achievements\/?(?:\?|$)/.test(request.url ?? "") ||
                        !response.headers.location
                      )
                        return;
                      try {
                        const destination = new URL(
                          response.headers.location,
                          "https://steamcommunity.com",
                        );
                        if (
                          destination.origin === "https://steamcommunity.com" &&
                          /^\/stats\/[^/]+\/achievements\/?$/.test(destination.pathname)
                        ) {
                          response.headers.location = `/api-proxy/steamcommunity.com${destination.pathname}${destination.search}`;
                        }
                      } catch {
                        /* Leave malformed or unrelated upstream redirects unchanged. */
                      }
                    });
                  },
                }
              : {}),
            rewrite: (path: string) => path.replace(`/api-proxy/${host}`, ""),
          },
        ]),
      ),
    },
    resolve: {
      alias: { "@": "/src" },
    },
    assetsInclude: ["**/*.onnx", "**/*.tflite"],
    optimizeDeps: {
      // Scan only app entries, not the installer or local HTML previews.
      entries: ["index.html", "index-tv.html"],
      // Reached only from a lazy route's own lazy child, so the scanner does not find it from an
      // entry. Discovered at runtime instead, it answers the first request with a 504 and a reload
      // the error boundary swallows, which strands that route until the dep cache is rebuilt.
      include: ["qrcode"],
      exclude: ["onnxruntime-web", "@mediapipe/tasks-vision"],
    },
    worker: { format: "es" },
  };
});
