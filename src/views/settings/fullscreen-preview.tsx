import { useT } from "@/lib/i18n";
import { isMacDesktop } from "@/lib/platform";
import { PlayerPreviewFrame } from "./player-preview-frame";

export function FullscreenPreview({ mode }: { mode: string }) {
  const t = useT();
  // A Mac has a menu bar and a Dock, and switches apps with Command-Tab.
  const mac = isMacDesktop();
  const note =
    mode === "maximized"
      ? mac
        ? t("Fills the screen, but the title bar, the menu bar and the Dock stay.")
        : t("Fills the screen, but the title bar and taskbar stay.")
      : mode === "borderless"
        ? mac
          ? t("Same coverage, but still a window, so switching apps stays instant.")
          : t("Same coverage, but still a window, so alt-tab stays instant.")
        : mac
          ? t("Covers everything. The menu bar and the Dock are hidden.")
          : t("Covers everything. The taskbar is hidden.");
  return (
    <PlayerPreviewFrame
      windowed={mode === "maximized"}
      note={note}
      imagePosition="center top"
      sampleIndex={16}
    />
  );
}
