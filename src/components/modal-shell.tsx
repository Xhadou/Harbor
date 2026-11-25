import { SoftDiv } from "@/components/soft-swap";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const EXIT_MS = 190;

export function useModalExit(onClose: () => void, open = true) {
  const [closing, setClosing] = useState(false);
  const fired = useRef(false);
  const close = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    setClosing(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    fired.current = false;
    setClosing(false);
  }, [open]);

  useEffect(() => {
    if (!closing) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(onClose, reduce ? 0 : EXIT_MS);
    return () => window.clearTimeout(id);
  }, [closing, onClose]);

  return { closing, close };
}

export function useEscape(
  onDismiss: () => void,
  active = true,
  scope?: RefObject<HTMLElement | null>,
) {
  // The listener must stay registered across renders. The navigation layer sees
  // Escape first and can cause a render before this listener's turn; one that
  // is removed and added again mid-event is skipped, and the key is lost.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if ((e.target as Element | null)?.closest?.("[data-dropdown-menu]")) return;
      if (scope) {
        // A nested career profile must not dismiss the event behind it as well.
        const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
        if (dialogs[dialogs.length - 1] !== scope.current) return;
      }
      e.stopImmediatePropagation();
      dismiss.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, scope]);
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside the top-most dialog. Without it Tab walks on into the page
 * behind the backdrop, where the focused control cannot even be seen.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      const root = ref.current;
      if (e.key !== "Tab" || !root) return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== root) return;
      const at = document.activeElement;
      // A menu the dialog opened lives outside it and runs its own keys.
      if (at instanceof Element && at.closest("[data-dropdown-menu]")) return;
      const items = [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (!root.contains(at)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [ref, active]);
}

export function ModalShell({
  closing,
  onDismiss,
  width = 640,
  labelledBy,
  backdropClassName,
  portalTarget,
  dismissOnBackdrop = true,
  children,
}: {
  closing: boolean;
  onDismiss: () => void;
  width?: number;
  labelledBy?: string;
  backdropClassName?: string;
  portalTarget?: Element;
  /**
   * Off for a dialog holding state a stray click must not destroy. The backdrop then
   * becomes a drag region instead, so the window can still be moved around the dialog.
   */
  dismissOnBackdrop?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscape(onDismiss, true, dialogRef);
  useFocusTrap(dialogRef);
  // A dialog that only dims the page takes the shared macOS look. One that
  // brings a backdrop class of its own styles its panel through it.
  const shared = !backdropClassName || /^bg-black\/\d+$/.test(backdropClassName);

  return createPortal(
    <SoftDiv
      data-arrives=""
      className={`fixed inset-0 z-[240] grid place-items-center p-8 ${backdropClassName ?? ""} ${
        shared ? "mac-scrim" : ""
      } ${closing ? "animate-scrim-out" : "animate-scrim-in"}`}
      data-harbor-modal
      data-tauri-drag-region={dismissOnBackdrop ? undefined : ""}
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)` }}
        className={`flex max-h-[86vh] flex-col overflow-hidden rounded-md bg-surface ${
          shared ? "mac-dialog" : ""
        } ${closing ? "animate-dialog-out" : "animate-dialog-in"}`}
      >
        {children}
      </div>
    </SoftDiv>,
    portalTarget ?? document.body,
  );
}
