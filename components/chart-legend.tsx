"use client";

export function ChartLegend({
  items,
}: {
  items: Array<{
    key: string;
    label: string;
    color: string;
    note?: string;
    active: boolean;
    onToggle?: () => void;
  }>;
}) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-x-4">
      {items.map((item) => {
        const className = [
          "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition",
          item.active
            ? "border-white/10 bg-white/[0.07] text-[#d8d1ea]"
            : "border-white/5 bg-white/[0.025] text-[#8f88a9] opacity-55 hover:opacity-80",
        ].join(" ");
        const content = (
          <>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.active ? item.color : "#6b627f" }}
              aria-hidden
            />
            <span>{item.label}</span>
            {item.note ? (
              <span className="font-data text-[10px] uppercase tracking-[0.16em] text-[#8f88a9]">
                {item.note}
              </span>
            ) : null}
          </>
        );

        if (!item.onToggle) {
          return (
            <div key={item.key} className={className}>
              {content}
            </div>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.active}
            onClick={item.onToggle}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
