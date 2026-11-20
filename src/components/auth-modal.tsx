import { Check, ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useEscape, useFocusTrap } from "./modal-shell";
import { StremioWebButton } from "./auth-modal/stremio-web-button";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { signIn } = useAuth();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Capture phase: Harbor's navigation layer takes Escape as Back before a
  // bubbling listener would ever see it.
  useEscape(onClose);
  const dialogRef = useRef<HTMLFormElement>(null);
  useFocusTrap(dialogRef);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password, remember);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Sign-in failed"));
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="mac-scrim animate-scrim-in fixed inset-0 z-[240] flex items-center justify-center p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        data-tv-focus-scope
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="mac-dialog animate-dialog-in flex w-[min(92vw,420px)] flex-col gap-5 rounded-md bg-surface p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex flex-col gap-1.5">
          <span className="mac-hidden text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Stremio")}
          </span>
          <h2
            id="auth-modal-title"
            className="mac-type-heading font-display text-[22px] font-medium tracking-tight text-ink"
          >
            {t("Sign in")}
          </h2>
          <p className="mac-type-body text-[12.5px] leading-relaxed text-ink-subtle">
            {t("Brings in your library, watchlist, and installed addons.")}
          </p>
        </div>

        <StremioWebButton onDone={onClose} disabled={busy} />

        <span className="mac-label text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
          {t("or use email")}
        </span>

        <div className="flex flex-col gap-3">
          <Field
            label={t("Email")}
            type="email"
            value={email}
            onChange={setEmail}
            disabled={busy}
          />
          <Field
            label={t("Password")}
            type="password"
            value={password}
            onChange={setPassword}
            disabled={busy}
          />
        </div>

        <button
          type="button"
          onClick={() => setRemember((v) => !v)}
          disabled={busy}
          className="flex items-center gap-2.5 self-start text-start"
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-[4px] transition-colors ${
              remember ? "bg-ink" : "bg-edge"
            }`}
          >
            {remember && <Check size={11} strokeWidth={3} className="text-canvas" />}
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-medium text-ink">{t("Remember me")}</span>
            <span className="mac-type-caption text-[11.5px] text-ink-subtle">
              {t("Stays signed in on this device only.")}
            </span>
          </span>
        </button>

        {error && (
          <p className="mac-type-small rounded-md bg-danger/10 px-3.5 py-2.5 text-[12.5px] leading-snug text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="mac-btn mac-btn-lg mac-btn-secondary harbor-press-pop flex h-11 items-center justify-center gap-2 rounded-md bg-ink text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t("Signing in...")}
            </>
          ) : (
            t("Sign in with email")
          )}
        </button>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="mac-btn mac-btn-quiet mac-btn-edge-start text-[12.5px] text-ink-subtle transition-colors hover:text-ink-muted"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={() => openUrl("https://www.stremio.com/register")}
            className="mac-btn mac-btn-quiet mac-btn-edge-end flex items-center gap-1.5 text-[12.5px] text-ink-subtle transition-colors hover:text-ink-muted"
          >
            <span>{t("Create account")}</span>
            <ExternalLink size={11} />
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoFocus,
  disabled,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const t = useT();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="flex flex-col gap-1.5">
      <span className="mac-label text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
        {label}
      </span>
      <div className="relative">
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete={isPassword ? "current-password" : "email"}
          className={`mac-field mac-field-lg h-11 w-full rounded-md bg-canvas px-3.5 text-[14px] text-ink outline-none transition-[background-color,box-shadow] focus:bg-elevated disabled:opacity-50 ${
            isPassword ? "pe-11" : ""
          }`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShow((v) => !v)}
            disabled={disabled}
            aria-label={show ? t("Hide password") : t("Show password")}
            title={show ? t("Hide password") : t("Show password")}
            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-ink-subtle transition-colors hover:text-ink disabled:opacity-50"
          >
            {show ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
          </button>
        )}
      </div>
    </label>
  );
}
