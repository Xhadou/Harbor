import { channelLabel } from "@/lib/player/track-labels";
import type { AudioCodec, Codec, HdrFormat, ParsedStream, Source } from "./types";

/**
 * A source described from what the app parsed out of it, instead of the text
 * its addon wrote: the picture quality first, then the facts that set one
 * release apart from another. A fact the release does not state is left out.
 */
export type SourceFacts = {
  /** "4K Remux", "1080p WEB-DL", or "Unknown quality". */
  quality: string;
  /** HDR, video format, audio, edition, size: each already display text. */
  facts: string[];
};

const SOURCE_LABELS: Partial<Record<Source, string>> = {
  BluRay: "Blu-ray",
  REMUX: "Remux",
};

const HDR_LABELS: Record<HdrFormat, string> = {
  DV: "Dolby Vision",
  "DV+HDR10": "Dolby Vision",
  HDR10: "HDR10",
  "HDR10+": "HDR10+",
  HLG: "HLG",
};

const VIDEO_LABELS: Partial<Record<Codec, string>> = {
  HEVC: "HEVC",
  AVC: "H.264",
  AV1: "AV1",
  VP9: "VP9",
  MPEG2: "MPEG-2",
};

const AUDIO_LABELS: Partial<Record<AudioCodec, string>> = {
  Atmos: "Dolby Atmos",
  TrueHD: "Dolby TrueHD",
  "DTS-HD MA": "DTS-HD MA",
  DTS: "DTS",
  "DD+": "Dolby Digital+",
  AC3: "Dolby Digital",
  AAC: "AAC",
  Opus: "Opus",
  FLAC: "FLAC",
};

export function formatSourceSize(bytes: number | null | undefined): string | null {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return null;
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Number(gb.toFixed(1))} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

function audioFact(s: ParsedStream): string | null {
  const codec = AUDIO_LABELS[s.audio.codec] ?? null;
  // Stereo is what any file has; only a surround layout is worth a word.
  const layout = s.audio.channels > 2 ? channelLabel(null, s.audio.channels) : "";
  return [codec, layout].filter(Boolean).join(" ") || null;
}

export function sourceFacts(s: ParsedStream): SourceFacts {
  const statesNothing =
    s.resolution === "SD" &&
    s.source === "Other" &&
    s.codec === "Other" &&
    !s.hdrFormat &&
    s.audio.codec === "Other";
  const release = s.remux
    ? "Remux"
    : s.source === "Other"
      ? ""
      : (SOURCE_LABELS[s.source] ?? s.source);
  const quality = statesNothing
    ? "Unknown quality"
    : [s.resolution, release].filter(Boolean).join(" ");
  const facts = [
    s.hdrFormat ? HDR_LABELS[s.hdrFormat] : null,
    VIDEO_LABELS[s.codec] ?? null,
    audioFact(s),
    s.edition?.trim() || null,
    formatSourceSize(s.size),
  ].filter((fact): fact is string => !!fact);
  return { quality, facts };
}
