import { useEffect, useRef } from "react";
import { useSearchActions } from "@/lib/search-context";
import { useView } from "@/lib/view";
import { menuCommand } from "./menu-command";
import { onNativeEvent } from "./native-events";
import { useGatedNavigation, useSidebarToggle } from "./native-navigation";
import { useNativeSearchActive } from "./native-search-state";

/**
 * Carries out the macOS menu bar's Harbor commands. They are ignored while
 * the player is up: it has its own navigation, and routing underneath it
 * would change the page it returns to.
 */
export function NativeMenuBridge({ playerActive }: { playerActive: boolean }) {
  const { canGoBack, goBack } = useView();
  const { navigate, pinModal } = useGatedNavigation();
  const toggleSidebar = useSidebarToggle();
  const { setOpen } = useSearchActions();
  const searchAvailable = useNativeSearchActive();

  const latest = useRef({
    playerActive,
    canGoBack,
    goBack,
    navigate,
    toggleSidebar,
    setOpen,
    searchAvailable,
  });
  useEffect(() => {
    latest.current = {
      playerActive,
      canGoBack,
      goBack,
      navigate,
      toggleSidebar,
      setOpen,
      searchAvailable,
    };
  });

  useEffect(
    () =>
      onNativeEvent("menu", ({ action }) => {
        const now = latest.current;
        const command = menuCommand(action);
        if (!command || now.playerActive) return;
        if (command.kind === "view") now.navigate(command.view);
        else if (command.kind === "back") {
          if (now.canGoBack) now.goBack();
        } else if (command.kind === "toggle-sidebar") now.toggleSidebar();
        // Opening search focuses the toolbar field (see NativeToolbarBridge).
        else if (now.searchAvailable) now.setOpen(true);
      }),
    [],
  );

  return pinModal;
}
