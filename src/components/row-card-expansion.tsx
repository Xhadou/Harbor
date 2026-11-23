import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

type RowCardExpansionValue = {
  enabled: boolean;
  /** The row opens a card under a resting pointer (macOS card previews), not only under keyboard focus. */
  previews: boolean;
  expanded: boolean;
  /** The row this card is in: two cards with the same value share a row. */
  rowId: string;
  expand: (width: number) => void;
  collapse: () => void;
};

const RowCardExpansionContext = createContext<RowCardExpansionValue | null>(null);

export function RowCardExpansionProvider({
  index,
  enabled,
  previews = false,
  expanded,
  rowId = "",
  onExpand,
  onCollapse,
  children,
}: {
  index: number;
  enabled: boolean;
  previews?: boolean;
  expanded: boolean;
  rowId?: string;
  onExpand: (index: number, width: number) => void;
  onCollapse: (index: number) => void;
  children: ReactNode;
}) {
  const expand = useCallback((width: number) => onExpand(index, width), [index, onExpand]);
  const collapse = useCallback(() => onCollapse(index), [index, onCollapse]);
  const value = useMemo<RowCardExpansionValue>(
    () => ({ enabled, previews, expanded, rowId, expand, collapse }),
    [collapse, enabled, expand, expanded, previews, rowId],
  );

  return (
    <RowCardExpansionContext.Provider value={value}>{children}</RowCardExpansionContext.Provider>
  );
}

export function useRowCardExpansion(): RowCardExpansionValue | null {
  return useContext(RowCardExpansionContext);
}
