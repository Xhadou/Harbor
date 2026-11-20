// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { audioCodecLabel, channelLabel } from "../src/lib/player/track-labels";

test("channel layouts read as people say them", () => {
  assert.equal(channelLabel("5.1(side)"), "5.1");
  assert.equal(channelLabel("7.1"), "7.1");
  assert.equal(channelLabel("stereo"), "Stereo");
  assert.equal(channelLabel("mono"), "Mono");
  assert.equal(channelLabel("unknown6"), "5.1");
  assert.equal(channelLabel("unknown8"), "7.1");
  assert.equal(channelLabel(null, 2), "Stereo");
  assert.equal(channelLabel("unknown5"), "5 ch");
  assert.equal(channelLabel(""), "");
});

test("codec ids become names", () => {
  assert.equal(audioCodecLabel("dca (DTS Coherent Acoustics)"), "DTS");
  assert.equal(audioCodecLabel("ac3"), "Dolby Digital");
  assert.equal(audioCodecLabel("ATSC A/52A (AC-3)"), "Dolby Digital");
  assert.equal(audioCodecLabel("ATSC A/52B (AC-3, E-AC-3)"), "Dolby Digital+");
  assert.equal(audioCodecLabel("AAC (Advanced Audio Coding)"), "AAC");
  assert.equal(audioCodecLabel("FLAC (Free Lossless Audio Codec)"), "FLAC");
  assert.equal(audioCodecLabel("eac3"), "Dolby Digital+");
  assert.equal(audioCodecLabel("truehd"), "Dolby TrueHD");
  assert.equal(audioCodecLabel("aac"), "AAC");
  assert.equal(audioCodecLabel("wmav2 (Windows Media Audio 2)"), "wmav2");
  assert.equal(audioCodecLabel(""), "");
});
