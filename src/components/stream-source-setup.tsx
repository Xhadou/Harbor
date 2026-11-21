import { Check, Loader2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { AddonLogo } from "@/components/addon-logo";
import { installFromUrl } from "@/lib/addon-store";
import type { Addon } from "@/lib/addons";
import { useT } from "@/lib/i18n";
import { declaresStream } from "@/lib/streams/addon-priority";

/**
 * What a streaming source is, the ones already there, and a way to add one.
 * Setup shows it as a step; the first Play without a source shows it as a
 * dialog, so both say the same thing.
 */
export function StreamSourceSetup({
  titleId,
  sources,
  signedIn,
  playing,
  onBrowse,
  dialog = false,
  footer,
}: {
  titleId: string;
  /** Enabled addons that find streams; null while they are still being read. */
  sources: Addon[] | null;
  signedIn: boolean;
  /** The title Play was pressed on, when that is what brought this up. */
  playing?: string;
  onBrowse: () => void;
  /** In a dialog it takes the dialog's sizes: a heading, not a page title. */
  dialog?: boolean;
  /** The host's own button, set at the end of the row that holds "Browse addons". */
  footer?: ReactNode;
}) {
  const t = useT();
  const fieldId = useId();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const found = sources !== null && sources.length > 0;
  const large = dialog ? "" : "mac-btn-lg";

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = link.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const { addon } = await installFromUrl(value);
      window.dispatchEvent(
        new CustomEvent("harbor:addons-changed", {
          detail: { id: addon.manifest.id, installed: true },
        }),
      );
      setLink("");
      if (!declaresStream(addon)) {
        setNote(
          t("{name} was added, but it does not find streams. Add one that does.", {
            name: addon.manifest.name,
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Install failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col ${dialog ? "gap-4" : "gap-5"}`}>
      <div className="flex flex-col gap-1.5">
        <h1
          id={titleId}
          tabIndex={-1}
          className={`${dialog ? "mac-type-heading" : "mac-type-title"} text-ink outline-none`}
        >
          {found ? t("Streaming sources") : t("Add a streaming source")}
        </h1>
        <p className={`${dialog ? "mac-type-body" : "mac-type-lead"} text-ink-muted`}>
          {t(
            "Harbor lists films and shows, but it does not hold the video. A streaming source is an addon that finds it.",
          )}{" "}
          {found
            ? t("These are ready:")
            : playing
              ? t("You need one to play {title}.", { title: playing })
              : t("You need one to play anything.")}
        </p>
      </div>

      {sources === null ? (
        <p className="mac-type-body flex items-center gap-2 text-ink-subtle">
          <Loader2 size={14} className="animate-spin" />
          {t("Looking for your addons…")}
        </p>
      ) : found ? (
        <ul className="mac-setup-list">
          {sources.map((a) => (
            <li key={a.transportUrl}>
              <AddonLogo
                addonId={a.manifest.id}
                addonName={a.manifest.name}
                manifestLogo={a.manifest.logo}
              />
              <span className="min-w-0 flex-1 truncate">{a.manifest.name}</span>
              <Check size={15} strokeWidth={2.4} className="shrink-0 text-accent" />
            </li>
          ))}
        </ul>
      ) : (
        <form onSubmit={add} className="flex flex-col gap-2.5">
          <label htmlFor={fieldId} className="mac-label">
            {t("Addon link")}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={fieldId}
              type="text"
              value={link}
              // Read-only, not disabled, while it works: a disabled field drops focus.
              readOnly={busy}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…/manifest.json"
              spellCheck={false}
              autoComplete="off"
              className={`mac-field ${dialog ? "" : "mac-field-lg"} min-w-0 flex-1 font-mono outline-none`}
            />
            <button
              type="submit"
              disabled={busy || !link.trim()}
              className={`mac-btn ${large} mac-btn-main flex shrink-0`}
            >
              {busy ? t("Adding…") : t("Add")}
            </button>
          </div>
          {error && <p className="mac-type-small text-danger">{error}</p>}
          {note && <p className="mac-type-small text-ink-muted">{note}</p>}
          <p className="mac-type-small text-ink-subtle">
            {signedIn
              ? t(
                  "Your Stremio account has no streaming source yet. Paste the link from an addon's page; a stremio:// link works too.",
                )
              : t("Paste the link from an addon's page; a stremio:// link works too.")}
          </p>
        </form>
      )}
      {(footer || (sources !== null && !found)) && (
        <div className="flex items-center justify-between gap-2">
          {sources !== null && !found ? (
            <button
              type="button"
              onClick={onBrowse}
              className={`mac-btn ${large} mac-btn-secondary flex`}
            >
              {t("Browse addons")}
            </button>
          ) : (
            <span />
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
