import assert from "node:assert/strict";
import test from "node:test";
import { flushPromises, hookHarness } from "./helpers/hook-harness.ts";

function trailer(
  invoke: (...args: any[]) => Promise<unknown>,
  expected: { transcode?: boolean; audioUrl?: string; mac?: boolean } = {},
) {
  return hookHarness(
    "src/lib/trailer.ts",
    "fetchTrailer",
    {
      "@tauri-apps/api/core": { invoke },
      "@/lib/cache": {},
      "@/lib/cinemeta": {},
      "@/lib/providers/tmdb": {},
      "@/lib/platform": { isMacDesktop: () => expected.mac === true },
      "@/lib/stream-proxy": {
        registerStreamProxy: async (url: string, headers: unknown, options: unknown) => {
          assert.equal(url, "https://media.example/trailer.mp4");
          assert.deepEqual(headers, { "User-Agent": "extractor" });
          assert.deepEqual(options, {
            transcode: expected.transcode || undefined,
            fragmentedMp4: true,
            ...(expected.audioUrl ? { audioUrl: expected.audioUrl } : {}),
          });
          return { url: "http://localhost/trailer", sessionId: "fixture" };
        },
      },
    },
    { window: { __TAURI_INTERNALS__: {} } },
  );
}

test("trailer playback resolves a header-bound stream without downloading the video", async () => {
  const calls: string[] = [];
  const h = trailer(async (command) => {
    calls.push(command);
    return { url: "https://media.example/trailer.mp4", headers: { "User-Agent": "extractor" } };
  });
  const result = await h.render("fixture");
  assert.equal(result.stream_url, "http://localhost/trailer");
  assert.deepEqual(calls, ["resolve_youtube_stream"]);
  assert.equal(await h.render("fixture"), result, "resolved URLs are reused");
});

test("YouTube HLS playback requests a browser-compatible fragmented MP4 stream", async () => {
  const h = trailer(
    async () => ({
      url: "https://media.example/trailer.mp4",
      headers: { "User-Agent": "extractor" },
      transcode: true,
    }),
    { transcode: true },
  );
  assert.equal((await h.render("fixture")).stream_url, "http://localhost/trailer");
});

test("separate HLS audio is forwarded to the proxy", async () => {
  const h = trailer(
    async () => ({
      url: "https://media.example/trailer.mp4",
      audio_url: "https://media.example/trailer-audio.mp4",
      headers: { "User-Agent": "extractor" },
      transcode: true,
    }),
    { transcode: true, audioUrl: "https://media.example/trailer-audio.mp4" },
  );
  assert.equal((await h.render("fixture")).stream_url, "http://localhost/trailer");
});

const hls = (audio: boolean) => async () => ({
  url: "https://media.example/video/index.m3u8",
  ...(audio ? { audio_url: "https://media.example/audio/index.m3u8" } : {}),
  headers: { "User-Agent": "extractor" },
  transcode: true,
});

function macTrailer(invoke: (...args: any[]) => Promise<unknown>) {
  return hookHarness(
    "src/lib/trailer.ts",
    "fetchTrailer",
    {
      "@tauri-apps/api/core": { invoke },
      "@/lib/cache": {},
      "@/lib/cinemeta": {},
      "@/lib/providers/tmdb": {},
      "@/lib/platform": { isMacDesktop: () => true },
      "@/lib/stream-proxy": {
        registerStreamProxy: async () => {
          throw new Error("the proxy must not transcode a playlist the web view plays itself");
        },
      },
    },
    { window: { __TAURI_INTERNALS__: {} } },
  );
}

test("a Mac's web view is given an HLS playlist of the chosen picture and its sound, not the piped MP4 it cannot play", async () => {
  const result = await macTrailer(hls(true)).render("fixture");
  const prefix = "data:application/vnd.apple.mpegurl;base64,";
  assert.ok(result.stream_url.startsWith(prefix));
  const lines = atob(result.stream_url.slice(prefix.length)).split("\n");
  assert.equal(lines[0], "#EXTM3U");
  assert.ok(
    lines.some(
      (line) =>
        line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO") &&
        line.includes('URI="https://media.example/audio/index.m3u8"'),
    ),
  );
  const variant = lines.findIndex((line) => line.startsWith("#EXT-X-STREAM-INF:"));
  assert.ok(lines[variant].includes('AUDIO="audio"'));
  assert.equal(lines[variant + 1], "https://media.example/video/index.m3u8");
  assert.equal(result.file_path, "");
});

test("a Mac plays an HLS rendition that carries its own sound from its playlist as it is", async () => {
  const result = await macTrailer(hls(false)).render("fixture");
  assert.equal(result.stream_url, "https://media.example/video/index.m3u8");
});

test("every other web view still gets the proxy's fragmented MP4 for the same stream", async () => {
  const h = hookHarness(
    "src/lib/trailer.ts",
    "fetchTrailer",
    {
      "@tauri-apps/api/core": { invoke: hls(true) },
      "@/lib/cache": {},
      "@/lib/cinemeta": {},
      "@/lib/providers/tmdb": {},
      "@/lib/platform": { isMacDesktop: () => false },
      "@/lib/stream-proxy": {
        registerStreamProxy: async (url: string, _headers: unknown, options: unknown) => {
          assert.equal(url, "https://media.example/video/index.m3u8");
          assert.deepEqual(options, {
            transcode: true,
            fragmentedMp4: true,
            audioUrl: "https://media.example/audio/index.m3u8",
          });
          return { url: "http://localhost/trailer", sessionId: "fixture" };
        },
      },
    },
    { window: { __TAURI_INTERNALS__: {} } },
  );
  assert.equal((await h.render("fixture")).stream_url, "http://localhost/trailer");
});

test("a Mac still uses the proxy for a stream that is not HLS", async () => {
  const h = trailer(
    async () => ({
      url: "https://media.example/trailer.mp4",
      headers: { "User-Agent": "extractor" },
    }),
    { mac: true },
  );
  assert.equal((await h.render("fixture")).stream_url, "http://localhost/trailer");
});

test("stream extraction failure falls back to the existing download path", async () => {
  const calls: string[] = [];
  const h = trailer(async (command) => {
    calls.push(command);
    if (command === "resolve_youtube_stream") throw new Error("unavailable");
    return { file_path: "fixture.mp4" };
  });
  assert.equal((await h.render("fixture")).file_path, "fixture.mp4");
  assert.deepEqual(calls, ["resolve_youtube_stream", "fetch_trailer"]);
});

test("manual trailer prefetch starts the seekable download path", async () => {
  const calls: string[] = [];
  const h = hookHarness(
    "src/lib/trailer.ts",
    "prefetchTrailerDownload",
    {
      "@tauri-apps/api/core": {
        invoke: async (command: string) => {
          calls.push(command);
          return { file_path: "fixture.mp4" };
        },
      },
      "@/lib/cache": {},
      "@/lib/cinemeta": {},
      "@/lib/providers/tmdb": {},
      "@/lib/platform": { isMacDesktop: () => false },
      "@/lib/stream-proxy": {},
    },
    { window: { __TAURI_INTERNALS__: {} } },
  );
  h.render("fixture");
  await flushPromises();
  assert.deepEqual(calls, ["fetch_trailer"]);
});
