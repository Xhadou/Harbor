import { createContext, useContext, type ReactNode } from "react";
import { isMacDesktop } from "@/lib/platform";
import { useSectionBack } from "@/lib/section-back";
import { nativeBackState } from "./native-back-state";

// null: no page has opted in above this component (a dialog, another platform's shell).
const PageFront = createContext<boolean | null>(null);

/**
 * A page wraps its content in this and says whether it is the page in front.
 * Pages stay mounted while another page covers them, and a covered page must
 * not answer the window's Back button.
 */
export function NativeBackScope({ front, children }: { front: boolean; children: ReactNode }) {
  return <PageFront.Provider value={front}>{children}</PageFront.Provider>;
}

/**
 * On macOS the round Back button in the window's toolbar is the only Back.
 * A page that steps back within itself (a list opened inside Library, the
 * form inside Live TV) gives that step to the button.
 *
 * Returns true when the button has taken the step over, so the page leaves
 * its own Back out. `front` is for a page that knows it directly instead of
 * through a `NativeBackScope`.
 */
export function useNativeBack(onBack: () => void, enabled = true, front?: boolean): boolean {
  const scope = useContext(PageFront);
  const { handled, listening } = nativeBackState({
    mac: isMacDesktop(),
    front: front ?? scope,
    enabled,
  });
  useSectionBack(onBack, listening);
  return handled;
}
