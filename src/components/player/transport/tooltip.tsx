export function Tooltip({
  label,
  children,
  side = "top",
  align = "center",
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  align?: "center" | "end";
  /** Keeps the wrapper but shows no label, e.g. while the button's menu is open. */
  disabled?: boolean;
}) {
  return (
    <div className="group/tip relative inline-flex">
      {children}
      <div
        role="tooltip"
        hidden={disabled}
        className={`pointer-events-none absolute z-30 w-max max-w-[180px] rounded-md border border-white/10 bg-black/85 px-2 py-1 text-[11.5px] font-medium leading-snug text-white/90 opacity-0 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md transition-opacity delay-0 duration-100 group-hover/tip:opacity-100 group-hover/tip:delay-500 ${
          side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
        } ${align === "end" ? "end-0" : "left-1/2 -translate-x-1/2"}`}
      >
        {label}
      </div>
    </div>
  );
}
