import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { avatarFace, useAccountAvatarInputs } from "@/chrome/account-menu/account-avatar";
import { AccountMenu } from "@/chrome/account-menu/account-menu";
import { useSidebarNavigation } from "@/chrome/context-page-navigation";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useSearchActions } from "@/lib/search-context";
import { useProfiles } from "@/lib/profiles";
import { useUnseenReminderCount } from "@/lib/reminders";
import { useView, type View } from "@/lib/view";
import { nativeChromeCoverStore } from "./native-chrome-cover";
import { onNativeEvent, pushNativeJson } from "./native-events";
import { expectSidebar } from "./native-layout";
import { useGatedNavigation, useSidebarToggle } from "./native-navigation";
import { setNativeSearchParts } from "./native-search-state";
import { useSidebarAvatarImage } from "./sidebar-avatar";
import { settingsNavStore, settingsPageOf } from "./settings-sidebar";
import {
  buildNativeSidebar,
  findSidebarTarget,
  KIDS_PLAY_ID,
  profileInitials,
} from "./sidebar-items";

/**
 * Drives the native macOS sidebar from Harbor's own navigation model and
 * routes its clicks back. It replaces the React sidebar on macOS.
 */
export function NativeSidebarBridge({
  visible: wanted,
  pickerTop,
}: {
  visible: boolean;
  /** The source picker is in front: a page with no sidebar, where the player is not a page. */
  pickerTop: boolean;
}) {
  // Read on every render: skipping the hook while `wanted` is false changes the
  // hook order the first time the sidebar hides, which crashes the app.
  const covered = useSyncExternalStore(...nativeChromeCoverStore);
  const visible = wanted && !covered;
  const { entries, customization, kid, settings } = useSidebarNavigation();
  const { view, setView } = useView();
  const t = useT();
  const reminderCount = useUnseenReminderCount();
  const { go, pinModal } = useGatedNavigation();
  const toggleSidebar = useSidebarToggle();
  const { activeProfile } = useProfiles();
  const { locked } = useParental();
  const collapsed = settings.sidebarCollapsed;
  // Non-null while Settings is on screen: its pages take the list's place.
  const settingsNav = useSyncExternalStore(...settingsNavStore);

  const profileName = activeProfile?.name ?? "";
  // The same picture the account menu shows, not a stand-in.
  const face = avatarFace(useAccountAvatarInputs());
  const avatarImage = useSidebarAvatarImage(face.kind === "image" ? face.src : null);
  const navigation = buildNativeSidebar(entries, view, t, {
    renamed: customization.renamed,
    kid: !!kid,
    reminderCount,
    customOrder: customization.order.length > 0,
  });
  // Going to the source picker and coming back from it are changes of page, and the
  // sidebar slides away and back with them. Everything else that takes the sidebar (the
  // player, a dialog over the whole window) takes it at once.
  const [pickerTopSent, setPickerTopSent] = useState(pickerTop);
  const slide = pickerTopSent !== pickerTop;
  useEffect(() => setPickerTopSent(pickerTop), [pickerTop]);
  // In the render that changes page, so the new page is laid out where it will stay.
  useLayoutEffect(() => {
    expectSidebar(visible, collapsed);
  }, [visible, collapsed]);
  const payload = JSON.stringify({
    visible,
    collapsed,
    slide,
    ...navigation,
    ...(settingsNav ? { items: settingsNav.items, sections: settingsNav.sections } : null),
    // Under parental lock the profile cannot be switched, as in the React sidebar.
    account: locked
      ? null
      : {
          name: profileName,
          initials: face.kind === "initials" ? face.initials : profileInitials(profileName),
          color: face.kind === "initials" ? face.color : (face.ring ?? undefined),
          image: face.kind === "image" ? (avatarImage ?? undefined) : undefined,
        },
  });
  useEffect(() => {
    pushNativeJson("mac_native_sidebar_set", payload);
  }, [payload]);
  useEffect(() => {
    setNativeSearchParts({ sidebarShown: visible && !collapsed });
  }, [visible, collapsed]);
  useEffect(() => () => setNativeSearchParts({ sidebarShown: false }), []);

  // The account menu is Harbor's own; the native profile row only opens it.
  const accountAnchor = useRef<HTMLDivElement>(null);

  const { setOpen: setSearchOpen } = useSearchActions();
  const latest = useRef({ entries, go, setView, toggleSidebar, setSearchOpen, settingsNav });
  useEffect(() => {
    latest.current = { entries, go, setView, toggleSidebar, setSearchOpen, settingsNav };
  });

  useEffect(() => {
    const stops = [
      onNativeEvent("sidebar-select", ({ id }) => {
        const now = latest.current;
        // Search results sit beside the sidebar, not over it; leaving the
        // page has to take them down.
        now.setSearchOpen(false);
        const settingsPage = settingsPageOf(id);
        if (settingsPage !== null) {
          now.settingsNav?.select(settingsPage);
          return;
        }
        if (id === KIDS_PLAY_ID) {
          now.setView("kids");
          window.dispatchEvent(new CustomEvent("harbor:kids-play"));
          return;
        }
        const target = findSidebarTarget(now.entries, id);
        if (target) now.go(target.view as View, target.gated);
      }),
      onNativeEvent("toolbar-toggle-sidebar", () => latest.current.toggleSidebar()),
      onNativeEvent("sidebar-account", () => {
        accountAnchor.current
          ?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
          ?.click();
      }),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, []);

  return (
    <>
      {pinModal}
      {!locked && (
        <div
          ref={accountAnchor}
          className="fixed bottom-3 z-[70]"
          style={{ insetInlineStart: "var(--mac-sidebar-inset)" }}
        >
          <AccountMenu
            trigger="avatar"
            placement="up"
            align="start"
            showSettings
            onOpenSettings={() => setView("settings")}
            triggerClassName="pointer-events-none block h-px w-px overflow-hidden opacity-0"
          />
        </div>
      )}
    </>
  );
}
