import assert from "node:assert/strict";
import test from "node:test";
import { moreMenuRows, type MoreMenuState } from "../src/lib/player/more-menu-rows.ts";
import type { PlayerControlId } from "../src/lib/player-chrome.ts";

const ALL: PlayerControlId[] = [
  "chapter-menu",
  "aspect-menu",
  "anime4k-menu",
  "shader-menu",
  "screenshot",
  "download",
  "song-id",
  "draw-toggle",
];

const film: MoreMenuState = {
  engine: "mpv",
  isLiveChannel: false,
  hasChapters: true,
  canCrop: true,
  cropLabel: null,
  canShade: true,
  anime4kAvailable: true,
  anime4kLabel: null,
  hasInstalledShaders: false,
  download: { kind: "idle" },
  canDownload: true,
  showDraw: false,
  drawMode: false,
  hideOthersDrawings: false,
  songIdEnabled: false,
  songIdPending: false,
};

const rows = (controls: PlayerControlId[], state: Partial<MoreMenuState> = {}) =>
  moreMenuRows(controls, { ...film, ...state });
const keys = (controls: PlayerControlId[], state: Partial<MoreMenuState> = {}) =>
  rows(controls, state).map((row) => row.key);
const row = (key: string, state: Partial<MoreMenuState> = {}) => {
  const found = rows(ALL, state).find((item) => item.key === key);
  assert.ok(found, `row ${key} is listed`);
  return found;
};

test("a film on mpv lists its panels first, then its actions", () => {
  assert.deepEqual(
    rows(ALL).map((item) => [item.key, item.group, item.label]),
    [
      ["chapters", "panels", "Chapters"],
      ["picture", "panels", "Picture and aspect ratio"],
      ["anime4k", "panels", "Anime4K"],
      ["shaders", "panels", "Anime4K and shaders"],
      ["screenshot", "actions", "Screenshot"],
      ["download", "actions", "Download"],
    ],
  );
});

test("a panel row opens its own control's panel", () => {
  assert.deepEqual(row("chapters").action, { kind: "panel", control: "chapter-menu" });
  assert.deepEqual(row("picture").action, { kind: "panel", control: "aspect-menu" });
  assert.deepEqual(row("shaders").action, { kind: "panel", control: "shader-menu" });
});

test("only the controls handed in are listed", () => {
  assert.deepEqual(keys(["screenshot", "download"]), ["screenshot", "download"]);
  assert.deepEqual(keys([]), []);
});

test("a row is left out when the player cannot do what it offers", () => {
  assert.ok(!keys(ALL, { hasChapters: false }).includes("chapters"));
  assert.ok(!keys(ALL, { canCrop: false }).includes("picture"));
  const html5 = keys(ALL, { engine: "html5" });
  assert.deepEqual(html5, ["chapters", "screenshot", "download"]);
  assert.ok(!keys(ALL, { isLiveChannel: true }).includes("download"));
  assert.ok(!keys(ALL, { canDownload: false }).includes("download"));
});

test("shaders stay listed for installed shaders when Anime4K is missing", () => {
  const state = { anime4kAvailable: false, hasInstalledShaders: true };
  assert.ok(!keys(ALL, state).includes("anime4k"));
  assert.equal(row("shaders", state).label, "Shaders");
  assert.ok(!keys(ALL, { anime4kAvailable: false }).includes("shaders"));
});

test("a row shows the choice in effect", () => {
  assert.equal(row("picture").detail, undefined);
  assert.equal(row("picture", { cropLabel: "16:9" }).detail, "16:9");
  assert.equal(row("anime4k", { anime4kLabel: "Mode A" }).detail, "Mode A");
});

test("the download row follows the download", () => {
  assert.equal(row("download").action.kind, "download-start");

  const preparing = row("download", { download: { kind: "preparing" } });
  assert.equal(preparing.label, "Preparing download");
  assert.equal(preparing.disabled, true);

  const known = row("download", {
    download: { kind: "downloading", ratio: 0.42, receivedBytes: 42, totalBytes: 100 },
  });
  assert.equal(known.label, "Cancel download");
  assert.equal(known.detail, "42%");
  assert.equal(known.action.kind, "download-cancel");
  // Without a known size there is no honest percentage to show.
  const unknown = row("download", {
    download: { kind: "downloading", ratio: 0, receivedBytes: 42, totalBytes: null },
  });
  assert.equal(unknown.detail, undefined);

  const done = row("download", { download: { kind: "done", path: "/tmp/film.mkv" } });
  assert.equal(done.label, "Show downloaded file");
  assert.equal(done.action.kind, "download-reveal");

  const failed = row("download", { download: { kind: "error", message: "No space" } });
  assert.equal(failed.label, "Download failed");
  assert.equal(failed.detail, "No space");
  assert.equal(failed.action.kind, "download-reset");
});

test("drawing is offered only where it is shared, and grows its tools while on", () => {
  assert.ok(!keys(ALL).includes("draw"));
  assert.deepEqual(keys(["draw-toggle"], { showDraw: true }), ["draw"]);
  assert.equal(row("draw", { showDraw: true }).label, "Draw on screen");

  const drawing = { showDraw: true, drawMode: true };
  assert.deepEqual(keys(["draw-toggle"], drawing), ["draw", "draw-clear", "draw-hide-others"]);
  assert.equal(row("draw", drawing).label, "Stop drawing");
  assert.equal(row("draw", drawing).active, true);
  assert.equal(row("draw-hide-others", drawing).label, "Hide others' drawings");
  assert.equal(
    row("draw-hide-others", { ...drawing, hideOthersDrawings: true }).label,
    "Show others' drawings",
  );
});

test("song identification is listed when switched on, and waits while it listens", () => {
  assert.ok(!keys(ALL).includes("song-id"));
  assert.equal(row("song-id", { songIdEnabled: true }).label, "Identify song");
  assert.equal(row("song-id", { songIdEnabled: true }).disabled, undefined);
  assert.equal(row("song-id", { songIdEnabled: true, songIdPending: true }).disabled, true);
});
