"use client";

import { useEffect, useState } from "react";
import { Bookmark, Check, Link2, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useCollection } from "./collection-provider";
import {
  deleteSavedView, fromConfig, mySavedViews, rotateSavedViewToken, toConfig, upsertSavedView,
  type SavedViewConfig, type SavedViewRow,
} from "@/lib/collection/saved-view";

const SORT_LABELS: Record<string, string> = {
  cr: "Date added", n: "Card #", player: "Player", se: "Series", sn: "Serial #",
  cl: "Color", g: "Grade", pc: "Photos", cv: "Value", ev: "Est. value", pp: "Paid", ln: "Location",
};

// One-line human summary of a view's config, so the row shows what it captured
// (and visibly changes after "Update").
function summarize(config: SavedViewConfig): string {
  const parts: string[] = [];
  if (config.sort?.key) parts.push(`${SORT_LABELS[config.sort.key] ?? config.sort.key} ${config.sort.dir === "asc" ? "↑" : "↓"}`);
  const f = config.filters;
  const nFilters = (f?.teamIds?.length ?? 0) + (f?.setId != null ? 1 : 0) + (f?.locationIds?.length ?? 0) +
    ["rookie", "auto", "relic", "graded", "forSale", "special", "photo"].filter((k) => (f as Record<string, unknown>)?.[k]).length;
  if (nFilters > 0) parts.push(`${nFilters} filter${nFilters === 1 ? "" : "s"}`);
  if (config.search?.trim()) parts.push(`“${config.search.trim()}”`);
  return parts.join(" · ") || "No filters";
}

// "Views" button + sheet: save the current filter/sort/search state as a named
// view, re-apply any saved view in one tap, and share public ones via /v/<token>.
export function SavedViewsControl() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-ink">
        <Bookmark className="size-4 text-muted" /> Views
      </button>
      {open ? <SavedViewsSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SavedViewsSheet({ onClose }: { onClose: () => void }) {
  const { filters, sort, search, view, valueMode, dispatch } = useCollection();
  const [views, setViews] = useState<SavedViewRow[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [updated, setUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try { setViews(await mySavedViews()); } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void refresh(); }, []);

  const saveCurrent = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true); setError(null);
    try {
      await upsertSavedView({ name: n, config: toConfig({ filters, sort, search, view, valueMode }) });
      setName("");
      await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const apply = (v: SavedViewRow) => {
    dispatch({ t: "applyConfig", state: fromConfig(v.config) });
    onClose();
  };

  const togglePublic = async (v: SavedViewRow) => {
    try {
      await upsertSavedView({ id: v.saved_view_id, name: v.name, config: v.config, isPublic: !v.is_public, slug: v.slug });
      await refresh();
    } catch (e) { setError((e as Error).message); }
  };

  // Overwrite an existing view with the CURRENT filters/sort/search/layout
  // (so you can re-sort, then push it into the view the link already points at).
  const updateToCurrent = async (v: SavedViewRow) => {
    setError(null);
    try {
      await upsertSavedView({
        id: v.saved_view_id, name: v.name, isPublic: v.is_public, slug: v.slug,
        config: toConfig({ filters, sort, search, view, valueMode }),
      });
      await refresh();
      setUpdated(v.saved_view_id); setTimeout(() => setUpdated(null), 1800);
    } catch (e) { setError((e as Error).message); }
  };

  const copyLink = async (v: SavedViewRow) => {
    const url = `${window.location.origin}/v/${v.share_token}`;
    try { await navigator.clipboard.writeText(url); setCopied(v.saved_view_id); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };

  const rotate = async (v: SavedViewRow) => {
    if (!confirm("Rotate this view's link? The old link will stop working.")) return;
    try { await rotateSavedViewToken(v.saved_view_id); await refresh(); } catch (e) { setError((e as Error).message); }
  };

  const remove = async (v: SavedViewRow) => {
    if (!confirm(`Delete view "${v.name}"?`)) return;
    try { await deleteSavedView(v.saved_view_id); await refresh(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-base sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/5 p-4">
          <h3 className="font-semibold text-ink">Saved views</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X className="size-5" /></button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Save current */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Save current view</div>
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void saveCurrent(); }}
                placeholder="e.g. Ohtani — rarest first"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/70"
              />
              <button onClick={saveCurrent} disabled={!name.trim() || busy}
                className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Save</button>
            </div>
            <p className="mt-1 text-[11px] text-muted">Captures the current filters, sort, search and layout.</p>
          </div>

          {error ? <p className="text-sm text-gold">{error}</p> : null}

          {/* List */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your views</div>
            {views === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : views.length === 0 ? (
              <p className="text-sm text-muted">No saved views yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {views.map((v) => (
                  <div key={v.saved_view_id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => apply(v)} className="min-w-0 flex-1 text-left">
                        <div className="truncate text-sm font-medium text-ink">{v.name}</div>
                        <div className="truncate text-[11px] text-muted">{summarize(v.config)}</div>
                      </button>
                      <button onClick={() => remove(v)} className="shrink-0 rounded-lg p-2 text-muted hover:text-gold" title="Delete"><Trash2 className="size-4" /></button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
                      <button onClick={() => updateToCurrent(v)} title="Overwrite this view with the current filters, sort and layout"
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${updated === v.saved_view_id ? "border-brand/60 bg-brand/15 text-ink" : "border-white/10 text-muted hover:text-ink"}`}>
                        {updated === v.saved_view_id ? <Check className="size-3" /> : <Save className="size-3" />}
                        {updated === v.saved_view_id ? "Updated" : "Update"}
                      </button>
                      <button onClick={() => togglePublic(v)}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${v.is_public ? "border-brand/60 bg-brand/15 text-ink" : "border-white/10 text-muted hover:text-ink"}`}>
                        {v.is_public ? <Check className="size-3" /> : null} {v.is_public ? "Public" : "Make public"}
                      </button>
                      {v.is_public ? (
                        <>
                          <button onClick={() => copyLink(v)} className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted hover:text-ink">
                            <Link2 className="size-3" /> {copied === v.saved_view_id ? "Copied!" : "Copy link"}
                          </button>
                          <button onClick={() => rotate(v)} className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted hover:text-ink" title="Rotate link">
                            <RefreshCw className="size-3" /> Reset link
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
