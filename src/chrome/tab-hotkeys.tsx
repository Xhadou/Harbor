import { useEffect } from "react";
import { shouldHandleGlobalKeyboardEvent } from "@/lib/hotkeys";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { applyNavCustomization, useAvailableNavItems } from "./nav-items";
import { usePreviewNavCustomization } from "@/lib/theme-preview";

/** Asks for the next (1) or previous (-1) section; the macOS Go menu sends it. */
export const CYCLE_SECTION_EVENT = "harbor:cycle-section";

export function TabHotkeys() {
  const { settings } = useSettings();
  const { view, setView } = useView();
  const items = applyNavCustomization(
    useAvailableNavItems(),
    usePreviewNavCustomization(settings.navCustomization),
  );
  const enabled = settings.tabHotkeys !== false;
  const order = items
    .map((item) => item.view)
    .filter(Boolean)
    .join(",");
  useEffect(() => {
    const views = order.split(",").filter(Boolean);
    if (views.length === 0) return;
    const cycle = (step: number) => {
      const at = views.indexOf(view);
      const next = ((at < 0 ? 0 : at + step) + views.length) % views.length;
      setView(views[next] as Parameters<typeof setView>[0]);
    };
    const onCycle = (event: Event) => cycle((event as CustomEvent<number>).detail);
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (!shouldHandleGlobalKeyboardEvent(event)) return;
      if (event.key === "Tab") {
        event.preventDefault();
        cycle(event.shiftKey ? -1 : 1);
        return;
      }
      if (event.shiftKey) return;
      const slot = Number(event.key);
      if (!Number.isInteger(slot) || slot < 1 || slot > 9) return;
      const target = views[slot - 1];
      if (!target) return;
      event.preventDefault();
      setView(target as Parameters<typeof setView>[0]);
    };
    // The menu items work whether or not the key shortcuts are switched on.
    window.addEventListener(CYCLE_SECTION_EVENT, onCycle);
    // Capture, because the webview claims Ctrl+Tab before a bubble listener sees it.
    if (enabled) window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(CYCLE_SECTION_EVENT, onCycle);
    };
  }, [enabled, order, view, setView]);
  return null;
}
