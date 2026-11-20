import { useT } from "@/lib/i18n";
import { sourceFacts } from "@/lib/streams/source-facts";
import type { ParsedStream } from "@/lib/streams/types";

/**
 * A source as two lines of plain text built from what was parsed out of it:
 * its picture quality, then its facts and where it comes from. Used wherever
 * sources are listed, so the same release reads the same in each place.
 */
export function SourceFactsText({
  stream,
  from,
  extra = [],
}: {
  stream: ParsedStream;
  /** The addon or addons offering it. */
  from: string;
  /** Facts only the caller knows, such as a seed count. */
  extra?: string[];
}) {
  const t = useT();
  const { quality, facts } = sourceFacts(stream);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="truncate text-[13px] font-semibold leading-[18px] text-ink">
        {quality === "Unknown quality" ? t("Unknown quality") : quality}
      </p>
      <p className="truncate text-[12px] leading-4 text-ink-muted">
        {[...facts, ...extra, from].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
