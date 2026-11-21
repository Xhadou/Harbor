import { useEffect, useRef } from "react";

/** The pages whose rows can be reordered, hidden and renamed. */
export type EditablePage = "home" | "movies" | "shows" | "anime" | "discover";

export const EDITABLE_PAGES: readonly EditablePage[] = [
  "home",
  "movies",
  "shows",
  "anime",
  "discover",
];

let pending: EditablePage | null = null;
const listeners = new Set<() => void>();

/** Ask a page to enter its row editing mode. The page takes the request when it is next on screen. */
export function requestPageEdit(page: EditablePage): void {
  pending = page;
  for (const listener of listeners) listener();
}

/** True once for the page that was asked; the request is then spent. */
export function consumePageEditRequest(page: EditablePage): boolean {
  if (pending !== page) return false;
  pending = null;
  return true;
}

/**
 * Starts a page's editing mode when Settings asks for it. A page that is
 * already mounted hears the request; one that mounts later finds it waiting.
 */
export function usePageEditRequest(page: EditablePage, start: () => void): void {
  const begin = useRef(start);
  begin.current = start;
  useEffect(() => {
    const take = () => {
      if (consumePageEditRequest(page)) begin.current();
    };
    take();
    listeners.add(take);
    return () => {
      listeners.delete(take);
    };
  }, [page]);
}
