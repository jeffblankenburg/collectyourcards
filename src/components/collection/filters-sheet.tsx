"use client";

import { X } from "lucide-react";
import { useCollection } from "./collection-provider";
import { UNASSIGNED } from "@/lib/collection/index-types";

const FLAGS = [
  { key: "rookie", label: "Rookie" },
  { key: "auto", label: "Auto" },
  { key: "relic", label: "Relic" },
  { key: "graded", label: "Graded" },
  { key: "forSale", label: "For sale" },
  { key: "special", label: "★ Favorites" },
  { key: "photo", label: "Photo" },
] as const;

// On a public shared view these describe the owner's own copy state, not the
// catalog card — hide them (keep only card attributes + condition).
const PUBLIC_FLAG_KEYS = new Set(["rookie", "auto", "relic", "graded"]);

// Bottom-sheet with the heavy filters (teams / set / locations / flags), so the
// collection screen stays uncluttered. Applied live; "Clear all" resets.
export function FiltersSheet({ onClose }: { onClose: () => void }) {
  const { teams, sets, locations, filters, dispatch, publicMode } = useCollection();
  const flags = publicMode ? FLAGS.filter((f) => PUBLIC_FLAG_KEYS.has(f.key)) : FLAGS;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-base sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/5 p-4">
          <h3 className="font-semibold text-ink">Filters</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => dispatch({ t: "clearFilters" })} className="text-xs text-muted hover:text-ink">Clear all</button>
            <button onClick={onClose} className="text-muted hover:text-ink"><X className="size-5" /></button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          {/* Teams */}
          {teams.length > 0 ? (
            <Section label="Teams">
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {teams.map((t) => {
                  const active = filters.teamIds.has(t.id);
                  return (
                    <button key={t.id} onClick={() => dispatch({ t: "toggleTeam", id: t.id })}
                      className="relative flex shrink-0 flex-col items-center" title={`${t.abbr ?? ""} · ${t.count}`}>
                      <span className={`inline-flex size-9 items-center justify-center rounded-full text-[10px] font-bold text-white transition ${active ? "ring-2 ring-white ring-offset-2 ring-offset-[#080b14]" : "opacity-85 hover:opacity-100"}`}
                        style={{ backgroundColor: t.primary || "#334155", border: `2px solid ${t.secondary || "#94a3b8"}` }}>
                        {t.abbr}
                      </span>
                      <span className={`mt-1 text-[9px] tabular-nums ${active ? "font-semibold text-ink" : "text-muted"}`}>{t.count}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          ) : null}

          {/* Set */}
          <Section label="Set">
            <select
              value={filters.setId ?? ""}
              onChange={(e) => dispatch({ t: "setSet", id: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-ink outline-none"
            >
              <option value="">All sets</option>
              {sets.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.count})</option>)}
            </select>
          </Section>

          {/* Locations — owner only (a viewer shouldn't see where cards live) */}
          {!publicMode && locations.length > 0 ? (
            <Section label="Location">
              <div className="flex flex-wrap gap-2">
                <Chip label="Unassigned" active={filters.locationIds.has(UNASSIGNED)} onClick={() => dispatch({ t: "toggleLocation", id: UNASSIGNED })} />
                {locations.map((l) => (
                  <Chip key={l.user_location_id} label={l.location ?? "—"} active={filters.locationIds.has(l.user_location_id)}
                    onClick={() => dispatch({ t: "toggleLocation", id: l.user_location_id })} />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Flags */}
          <Section label="Attributes">
            <div className="flex flex-wrap gap-2">
              {flags.map((f) => (
                <Chip key={f.key} label={f.label} active={filters[f.key]} onClick={() => dispatch({ t: "toggleAttr", key: f.key })} />
              ))}
            </div>
          </Section>
        </div>

        <div className="flex items-center justify-end border-t border-white/5 p-4">
          <button onClick={onClose} className="rounded-xl bg-brand px-6 py-2 text-sm font-semibold text-white">Done</button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-brand/60 bg-brand/15 text-ink" : "border-white/10 bg-white/[0.04] text-muted hover:text-ink"}`}>
      {label}
    </button>
  );
}
