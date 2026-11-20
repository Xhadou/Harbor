// Turns what the player reports about an audio track into words a person uses.
// mpv hands back codec ids and channel-layout names ("dca", "5.1(side)",
// "unknown6"); shown as they are, they read as noise.

const CHANNELS_BY_COUNT: Readonly<Record<number, string>> = {
  1: "Mono",
  2: "Stereo",
  3: "2.1",
  6: "5.1",
  7: "6.1",
  8: "7.1",
};

export function channelLabel(layout?: string | null, count?: number | null): string {
  const raw = (layout ?? "").trim().toLowerCase();
  const base = raw.replace(/\(.*\)$/, "").trim();
  if (base === "mono") return "Mono";
  if (base === "stereo") return "Stereo";
  if (/^\d\.\d(\.\d)?$/.test(base)) return base;
  const unknown = /^unknown(\d+)$/.exec(base);
  const channels = count && count > 0 ? count : unknown ? Number(unknown[1]) : 0;
  if (channels > 0) return CHANNELS_BY_COUNT[channels] ?? `${channels} ch`;
  return base;
}

// The player reports either a short id ("ac3") or a description ("ATSC A/52A
// (AC-3)", "DCA (DTS Coherent Acoustics)"), so these match anywhere in it.
// Order matters: E-AC-3 before AC-3, which its description also mentions.
const AUDIO_CODECS: readonly (readonly [RegExp, string])[] = [
  [/e-?ac-?3/, "Dolby Digital+"],
  [/ac-?3|a\/52/, "Dolby Digital"],
  [/truehd/, "Dolby TrueHD"],
  [/\b(dca|dts)/, "DTS"],
  [/\bmlp\b/, "MLP"],
  [/\baac\b/, "AAC"],
  [/\bopus\b/, "Opus"],
  [/\bflac\b/, "FLAC"],
  [/\bvorbis\b/, "Vorbis"],
  [/\bmp[23]\b|mpeg audio layer/, "MP3"],
  [/\balac\b/, "ALAC"],
  [/\bpcm\b/, "PCM"],
];

export function audioCodecLabel(codec?: string | null): string {
  const raw = (codec ?? "").trim();
  if (!raw) return "";
  const id = raw.toLowerCase();
  for (const [pattern, label] of AUDIO_CODECS) if (pattern.test(id)) return label;
  // An unknown codec: keep its short name, drop a long description in brackets.
  return raw.replace(/\s*\(.*\)\s*$/, "") || raw;
}

// Subtitle formats as the player reports them (an ffmpeg codec name or its
// long description), in the short form people know them by.
const SUBTITLE_FORMATS: Array<[RegExp, string]> = [
  [/pgs/, "PGS"],
  [/subrip|\bsrt\b/, "SRT"],
  [/\bssa\b/, "SSA"],
  [/\bass\b|substation/, "ASS"],
  [/vtt/, "WebVTT"],
  [/dvd|vobsub/, "VobSub"],
  [/dvb/, "DVB"],
  [/mov_text|tx3g|timed text/, "Timed text"],
  [/eia_608|eia-608|cea_608|cea_708|closed caption/, "Closed captions"],
];

export function subtitleFormatLabel(codec?: string | null): string {
  const raw = (codec ?? "").trim();
  if (!raw) return "";
  const id = raw.toLowerCase();
  for (const [pattern, label] of SUBTITLE_FORMATS) if (pattern.test(id)) return label;
  // An unknown format: its name without the word "subtitle" or the underscores.
  return (
    raw
      .replace(/[_-]+/g, " ")
      .replace(/\bsubtitles?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase() || raw
  );
}
