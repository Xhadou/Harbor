// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { audioCodecLabel, channelLabel, subtitleFormatLabel } from "../src/lib/player/track-labels";

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

test("a subtitle format reads as its short name, not as the player's codec string", () => {
  assert.equal(subtitleFormatLabel("subrip subtitle"), "SRT");
  assert.equal(subtitleFormatLabel("SUBRIP"), "SRT");
  assert.equal(subtitleFormatLabel("srt"), "SRT");
  assert.equal(subtitleFormatLabel("hdmv_pgs_subtitle"), "PGS");
  assert.equal(subtitleFormatLabel("ass"), "ASS");
  assert.equal(subtitleFormatLabel("Advanced SubStation Alpha (ASS)"), "ASS");
  assert.equal(subtitleFormatLabel("ssa"), "SSA");
  assert.equal(subtitleFormatLabel("webvtt"), "WebVTT");
  assert.equal(subtitleFormatLabel("dvd_subtitle"), "VobSub");
  assert.equal(subtitleFormatLabel("dvb_subtitle"), "DVB");
  assert.equal(subtitleFormatLabel("mov_text"), "Timed text");
  assert.equal(subtitleFormatLabel("eia_608"), "Closed captions");
});

test("an unknown subtitle format keeps its name, tidied; a missing one is blank", () => {
  assert.equal(subtitleFormatLabel("arib_caption"), "ARIB CAPTION");
  assert.equal(subtitleFormatLabel("  "), "");
  assert.equal(subtitleFormatLabel(null), "");
});
