import { useEffect, useRef, useState } from "react";
import { useOnboarding } from "@/lib/onboarding";
import { isMacDesktop } from "@/lib/platform";
import { useView } from "@/lib/view";

/**
 * A first-run tip. On macOS it is shown on the first page that qualifies and
 * counts as seen from that moment: it stays for that visit, then never comes
 * back, whether or not it was closed. Other platforms keep it until it is
 * closed by hand.
 */
export function useTipOnce(
  key: string,
  eligible: boolean,
): { visible: boolean; close: () => void } {
  const { isDismissed, dismiss } = useOnboarding();
  const { topPath } = useView();
  const mac = isMacDesktop();
  const dismissed = isDismissed(key);
  // The page the tip first appeared on; "" once that visit is over.
  const shownAt = useRef<string | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!mac) return;
    if (shownAt.current === null) {
      if (!eligible || dismissed) return;
      shownAt.current = topPath;
      dismiss(key);
    } else if (shownAt.current !== topPath) {
      shownAt.current = "";
    }
  }, [mac, eligible, dismissed, topPath, key, dismiss]);

  if (!mac) return { visible: eligible && !dismissed, close: () => dismiss(key) };
  const inFirstVisit = shownAt.current === null ? !dismissed : shownAt.current === topPath;
  return {
    visible: eligible && inFirstVisit && !closed,
    close: () => {
      dismiss(key);
      setClosed(true);
    },
  };
}
