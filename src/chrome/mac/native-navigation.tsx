import { useCallback, useState, type ReactNode } from "react";
import { useSidebarNavigation } from "@/chrome/context-page-navigation";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useParental } from "@/lib/parental";
import { useSettings } from "@/lib/settings";
import { useView, type View } from "@/lib/view";
import { menuNavigation } from "./sidebar-items";

/**
 * Navigation from native macOS chrome, with the same parental gate the React
 * sidebar applies: a locked destination opens the PIN prompt and only routes
 * once the PIN is accepted. Render `pinModal` somewhere in the caller.
 */
export function useGatedNavigation(): {
  /** Route to `view`; `gated` is whether a PIN is required first. */
  go: (view: View, gated: boolean) => void;
  /** Route to `view`, looking up whether it is gated in the sidebar's entries. */
  navigate: (view: View) => void;
  pinModal: ReactNode;
} {
  const { setView } = useView();
  const { unlock } = useParental();
  const { entries, locked, kid } = useSidebarNavigation();
  const [pendingPinView, setPendingPinView] = useState<View | null>(null);

  const go = useCallback(
    (view: View, gated: boolean) => {
      if (gated) setPendingPinView(view);
      else setView(view);
    },
    [setView],
  );
  const navigate = (view: View) => {
    const allowed = menuNavigation(entries, view, { locked, kid: !!kid });
    if (allowed !== "ignore") go(view, allowed === "pin");
  };

  const pinModal = pendingPinView ? (
    <ParentalPinModal
      mode={{
        kind: "unlock",
        onUnlock: () => {
          const view = pendingPinView;
          setPendingPinView(null);
          if (view) setView(view);
        },
        onCancel: () => setPendingPinView(null),
      }}
      verify={unlock}
    />
  ) : null;

  return { go, navigate, pinModal };
}

/** Shows or hides the sidebar; the toolbar button and the View menu share it. */
export function useSidebarToggle(): () => void {
  const { settings, update } = useSettings();
  const collapsed = settings.sidebarCollapsed;
  return useCallback(() => update({ sidebarCollapsed: !collapsed }), [collapsed, update]);
}
