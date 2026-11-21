import { useEffect, useRef } from "react";
import { reloadAppWindow } from "@/lib/app-reload";
import { useSearchActions } from "@/lib/search-context";
import { useTogether } from "@/lib/together/provider";
import { useView } from "@/lib/view";
import { CYCLE_SECTION_EVENT } from "@/chrome/tab-hotkeys";
import { menuCommand } from "./menu-command";
import { onNativeEvent } from "./native-events";
import { useGatedNavigation, useSidebarToggle } from "./native-navigation";
import { searchAllowed } from "./native-search-state";

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
  const { openModal } = useTogether();

  const latest = useRef({
    playerActive,
    canGoBack,
    goBack,
    navigate,
    toggleSidebar,
    setOpen,
    openModal,
  });
  useEffect(() => {
    latest.current = {
      playerActive,
      canGoBack,
      goBack,
      navigate,
      toggleSidebar,
      setOpen,
      openModal,
    };
  });

  useEffect(
    () =>
      onNativeEvent("menu", ({ action }) => {
        const now = latest.current;
        const command = menuCommand(action);
        if (!command || now.playerActive) return;
        if (command.kind === "view") {
          now.setOpen(false);
          now.navigate(command.view);
        } else if (command.kind === "back") {
          if (!now.canGoBack) return;
          now.setOpen(false);
          now.goBack();
        } else if (command.kind === "cycle-section") {
          now.setOpen(false);
          window.dispatchEvent(new CustomEvent(CYCLE_SECTION_EVENT, { detail: command.step }));
        } else if (command.kind === "toggle-sidebar") now.toggleSidebar();
        else if (command.kind === "reload") reloadAppWindow();
        // "auto" is taken up by the Watch together button on screen, which then shows its panel.
        else if (command.kind === "watch-together") now.openModal("auto");
        // With the sidebar shown this focuses its field (see
        // NativeToolbarBridge); hidden, Harbor's own search input opens.
        else if (searchAllowed()) now.setOpen(true);
      }),
    [],
  );

  return pinModal;
}
