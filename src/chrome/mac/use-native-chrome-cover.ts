import { useEffect } from "react";
import { setNativeChromeCovered } from "./native-chrome-cover";

/**
 * For a web layer that fills the window (a lock screen, the profile picker,
 * the screensaver): while `covering`, the native macOS sidebar and buttons,
 * which float above the page, are hidden. Does nothing on other platforms.
 */
export function useCoverNativeChrome(layer: string, covering: boolean): void {
  useEffect(() => {
    setNativeChromeCovered(layer, covering);
    return () => setNativeChromeCovered(layer, false);
  }, [layer, covering]);
}
