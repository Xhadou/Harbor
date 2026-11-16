// What the native macOS toolbar should show, derived from web app state.

export type NativeToolbarPayload = {
  visible: boolean;
  canGoBack: boolean;
  searchVisible: boolean;
};

export function toolbarPayload(input: {
  playerActive: boolean;
  immersive: boolean;
  canGoBack: boolean;
  searchHidden: boolean;
}): NativeToolbarPayload {
  const visible = !input.playerActive && !input.immersive;
  return {
    visible,
    canGoBack: input.canGoBack,
    searchVisible: visible && !input.searchHidden,
  };
}

/** Views where Harbor offers no global search (they have their own, or none applies). */
export function searchHiddenFor(input: {
  view: string;
  topKind: string;
  connecting: boolean;
  kid: boolean;
}): boolean {
  return (
    input.kid ||
    input.connecting ||
    input.topKind === "picker" ||
    input.view === "music" ||
    input.view === "games" ||
    input.view === "addons" ||
    input.view === "settings"
  );
}
