// Whether the window's Back button stands in for a page's own Back.

export type NativeBackState = {
  /** The page leaves its own Back control out. */
  handled: boolean;
  /** The page answers the window's Back button right now. */
  listening: boolean;
};

/**
 * `front` is null where no page has opted in (a dialog, a panel inside the
 * player); there the page keeps its own Back. A page that is covered by
 * another stays mounted, so it is handled but must not listen.
 */
export function nativeBackState(input: {
  mac: boolean;
  front: boolean | null;
  enabled: boolean;
}): NativeBackState {
  const handled = input.mac && input.front !== null;
  return { handled, listening: handled && input.enabled && input.front === true };
}
