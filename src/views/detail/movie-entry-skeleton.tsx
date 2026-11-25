import { SoftDiv } from "@/components/soft-swap";

export function MovieEntrySkeleton() {
  return (
    <SoftDiv className="h-[300px] w-full animate-pulse rounded-2xl border border-edge-soft/50 bg-elevated/40" />
  );
}
