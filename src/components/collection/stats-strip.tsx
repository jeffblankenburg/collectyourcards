"use client";

import { useCollection } from "./collection-provider";
import { money } from "@/lib/collection/index-types";

// Compact always-visible stats row (info only; the flag toggles live in the
// Filters sheet). Value is tappable to flip current ↔ estimated.
export function StatsStrip() {
  const { stats, valueMode, dispatch } = useCollection();
  return (
    <div className="grid grid-cols-4 gap-2">
      <Stat label="Cards" value={stats.count.toLocaleString()} />
      <Stat label={valueMode === "current" ? "Value" : "Est. value"} value={money(stats.value)} onClick={() => dispatch({ t: "valueMode" })} />
      <Stat label="Players" value={stats.players.toLocaleString()} />
      <Stat label="Rookies" value={stats.rookies.toLocaleString()} />
    </div>
  );
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const inner = (
    <>
      <div className="truncate text-sm font-semibold tabular-nums text-ink">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted">{label}</div>
    </>
  );
  const cls = "rounded-xl border border-white/5 bg-white/[0.03] px-1 py-1.5 text-center";
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} transition hover:bg-white/[0.06]`}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}
