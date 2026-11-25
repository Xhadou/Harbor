import { forwardRef, useRef, type HTMLAttributes } from "react";
import { useLeaveSoftly } from "@/lib/soft-leave";

/**
 * A `div` with a soft exit on macOS: when it is unmounted (a menu dismissed, a
 * panel no longer wanted) a fading copy is left where it was, instead of it
 * being gone in one frame. Everywhere else it is a plain `div`. Use it for the
 * element that is conditionally rendered, since the exit is taken at its
 * unmount; add `data-arrives` for the entrance that goes with it.
 */
export const SoftDiv = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function SoftDiv(props, forwarded) {
    const own = useRef<HTMLDivElement | null>(null);
    useLeaveSoftly(own);
    return (
      <div
        ref={(el) => {
          own.current = el;
          if (typeof forwarded === "function") forwarded(el);
          else if (forwarded) forwarded.current = el;
        }}
        {...props}
      />
    );
  },
);

/**
 * A block whose contents are replaced wholesale (a tab's body, the content
 * that takes a loading placeholder's place). When `swapKey` changes, the old
 * contents fade out over the new ones fading in, instead of one replacing the
 * other in a single frame. It renders a `div` and takes its attributes.
 */
export function SoftSwap({
  swapKey,
  ...rest
}: { swapKey: string | number } & HTMLAttributes<HTMLDivElement>) {
  return <SoftDiv key={swapKey} data-arrives="" {...rest} />;
}
