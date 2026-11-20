import assert from "node:assert/strict";
import test from "node:test";
import { formatSourceSize, sourceFacts } from "../src/lib/streams/source-facts.ts";
import type { ParsedStream } from "../src/lib/streams/types.ts";

const stream = (over: Partial<ParsedStream> = {}): ParsedStream =>
  ({
    addonId: "comet",
    addonName: "Comet",
    parsedTitle: "The Odyssey",
    resolution: "4K",
    hdrFormat: "DV",
    codec: "HEVC",
    source: "BluRay",
    remux: true,
    audio: { codec: "DTS-HD MA", channels: 6 },
    audioLanguages: [],
    size: 92.7 * 1024 ** 3,
    edition: null,
    ...over,
  }) as ParsedStream;

test("a source reads as its picture quality, then the facts that set it apart", () => {
  assert.deepEqual(sourceFacts(stream()), {
    quality: "4K Remux",
    facts: ["Dolby Vision", "HEVC", "DTS-HD MA 5.1", "92.7 GB"],
  });
});

test("the kind of release is named the way people say it", () => {
  assert.equal(sourceFacts(stream({ remux: false })).quality, "4K Blu-ray");
  assert.equal(sourceFacts(stream({ remux: false, source: "REMUX" })).quality, "4K Remux");
  assert.equal(
    sourceFacts(stream({ remux: false, source: "WEB-DL", resolution: "1080p" })).quality,
    "1080p WEB-DL",
  );
  assert.equal(
    sourceFacts(stream({ remux: false, source: "Other", resolution: "720p" })).quality,
    "720p",
  );
  assert.equal(
    sourceFacts(stream({ remux: false, source: "CAM", resolution: "SD" })).quality,
    "SD CAM",
  );
});

test("a fact the release does not state is left out, not shown as unknown", () => {
  const bare = sourceFacts(
    stream({
      remux: false,
      source: "WEBRip",
      resolution: "1080p",
      hdrFormat: null,
      codec: "Other",
      audio: { codec: "Other", channels: 2 },
      size: null,
    }),
  );
  assert.deepEqual(bare, { quality: "1080p WEBRip", facts: [] });
});

test("a release that states nothing about itself says so once", () => {
  const nothing = sourceFacts(
    stream({
      remux: false,
      source: "Other",
      resolution: "SD",
      hdrFormat: null,
      codec: "Other",
      audio: { codec: "Other", channels: 2 },
      size: 700 * 1024 ** 2,
    }),
  );
  assert.deepEqual(nothing, { quality: "Unknown quality", facts: ["700 MB"] });
});

test("HDR and audio formats carry their full names", () => {
  const facts = (over: Partial<ParsedStream>) => sourceFacts(stream({ size: null, ...over })).facts;
  assert.deepEqual(facts({ hdrFormat: "DV+HDR10" }).slice(0, 1), ["Dolby Vision"]);
  assert.deepEqual(facts({ hdrFormat: "HDR10+" }).slice(0, 1), ["HDR10+"]);
  assert.deepEqual(facts({ hdrFormat: null, codec: "AVC" }), ["H.264", "DTS-HD MA 5.1"]);
  assert.equal(facts({ audio: { codec: "Atmos", channels: 8 } }).at(-1), "Dolby Atmos 7.1");
  assert.equal(facts({ audio: { codec: "TrueHD", channels: 8 } }).at(-1), "Dolby TrueHD 7.1");
  assert.equal(facts({ audio: { codec: "DD+", channels: 6 } }).at(-1), "Dolby Digital+ 5.1");
  assert.equal(facts({ audio: { codec: "AC3", channels: 6 } }).at(-1), "Dolby Digital 5.1");
  assert.equal(facts({ audio: { codec: "AAC", channels: 2 } }).at(-1), "AAC");
  assert.equal(facts({ audio: { codec: "Other", channels: 6 } }).at(-1), "5.1");
});

test("an edition is a fact of the release", () => {
  assert.ok(sourceFacts(stream({ edition: "Extended" })).facts.includes("Extended"));
});

test("sizes are written to a useful precision", () => {
  assert.equal(formatSourceSize(92.7 * 1024 ** 3), "92.7 GB");
  assert.equal(formatSourceSize(2 * 1024 ** 3), "2 GB");
  assert.equal(formatSourceSize(1.46 * 1024 ** 3), "1.5 GB");
  assert.equal(formatSourceSize(850.4 * 1024 ** 2), "850 MB");
  assert.equal(formatSourceSize(0), null);
  assert.equal(formatSourceSize(null), null);
});
