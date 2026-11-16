import { useEffect, useRef } from "react";
import { useSidebarNavigation } from "@/chrome/context-page-navigation";
import { useT } from "@/lib/i18n";
import { useUnseenReminderCount } from "@/lib/reminders";
import { useView, type View } from "@/lib/view";
import { onNativeEvent, pushNativeJson } from "./native-events";
import { useGatedNavigation, useSidebarToggle } from "./native-navigation";
import { findSidebarTarget, KIDS_PLAY_ID, toNativeSidebarItems } from "./sidebar-items";

/**
 * Drives the native macOS sidebar from Harbor's own navigation model and
 * routes its clicks back. It replaces the React sidebar on macOS.
 */
export function NativeSidebarBridge({ visible }: { visible: boolean }) {
  const { entries, customization, kid, settings } = useSidebarNavigation();
  const { view, setView } = useView();
  const t = useT();
  const reminderCount = useUnseenReminderCount();
  const { go, pinModal } = useGatedNavigation();
  const toggleSidebar = useSidebarToggle();

  const payload = JSON.stringify({
    visible,
    collapsed: settings.sidebarCollapsed,
    items: toNativeSidebarItems(entries, view, t, {
      renamed: customization.renamed,
      kid: !!kid,
      reminderCount,
    }),
  });
  useEffect(() => {
    pushNativeJson("mac_native_sidebar_set", payload);
  }, [payload]);

  const latest = useRef({ entries, go, setView, toggleSidebar });
  useEffect(() => {
    latest.current = { entries, go, setView, toggleSidebar };
  });

  useEffect(() => {
    const stops = [
      onNativeEvent("sidebar-select", ({ id }) => {
        const now = latest.current;
        if (id === KIDS_PLAY_ID) {
          now.setView("kids");
          window.dispatchEvent(new CustomEvent("harbor:kids-play"));
          return;
        }
        const target = findSidebarTarget(now.entries, id);
        if (target) now.go(target.view as View, target.gated);
      }),
      onNativeEvent("toolbar-toggle-sidebar", () => latest.current.toggleSidebar()),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, []);

  return pinModal;
}
