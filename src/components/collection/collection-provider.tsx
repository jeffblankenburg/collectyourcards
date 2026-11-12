"use client";

import {
  createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useReducer, useRef, type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import type { AgencyRow, CompactRow, LocationRow } from "@/lib/collection/index-types";
import {
  EMPTY_FILTERS, computeStats, runPipeline, setFacets, teamFacets,
  type Filters, type SortState, type ValueMode, type ViewMode,
} from "@/lib/collection/pipeline";
import { getCachedRows, setCachedRows, syncCachedRows } from "@/lib/collection/collection-cache";
import { loadAgencies, loadCollectionIndex, loadLocations } from "@/lib/collection/load-index";

type AttrKey = "rookie" | "auto" | "relic" | "graded" | "forSale" | "special" | "photo";

interface State {
  status: "loading" | "ready" | "error";
  error: string | null;
  rows: CompactRow[];
  locations: LocationRow[];
  agencies: AgencyRow[];
  view: ViewMode;
  sort: SortState;
  filters: Filters;
  search: string;
  valueMode: ValueMode;
  viewingId: number | null;
  editingId: number | null;
}

type Action =
  | { t: "data"; rows: CompactRow[]; locations: LocationRow[]; agencies: AgencyRow[] }
  | { t: "status"; status: State["status"]; error?: string }
  | { t: "rows"; rows: CompactRow[] }
  | { t: "locations"; locations: LocationRow[] }
  | { t: "view"; view: ViewMode }
  | { t: "sort"; key: SortState["key"] }
  | { t: "toggleTeam"; id: number }
  | { t: "toggleLocation"; id: number }
  | { t: "setSet"; id: number | null }
  | { t: "toggleAttr"; key: AttrKey }
  | { t: "clearFilters" }
  | { t: "search"; value: string }
  | { t: "applyConfig"; state: Pick<State, "filters" | "sort" | "search" | "view" | "valueMode"> }
  | { t: "valueMode" }
  | { t: "viewing"; id: number | null }
  | { t: "editing"; id: number | null }
  | { t: "patchRow"; id: number; patch: Partial<CompactRow> }
  | { t: "removeRow"; id: number };

const INITIAL: State = {
  status: "loading", error: null, rows: [], locations: [], agencies: [],
  view: "list", sort: { key: "cr", dir: "desc" }, filters: EMPTY_FILTERS,
  search: "", valueMode: "current", viewingId: null, editingId: null,
};

function toggleSet(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "data": return { ...s, status: "ready", rows: a.rows, locations: a.locations, agencies: a.agencies };
    case "status": return { ...s, status: a.status, error: a.error ?? null };
    case "rows": return { ...s, rows: a.rows };
    case "locations": return { ...s, locations: a.locations };
    case "view": return { ...s, view: a.view };
    case "sort": {
      const dir = s.sort.key === a.key ? (s.sort.dir === "asc" ? "desc" : "asc") : (a.key === "cr" ? "desc" : "asc");
      return { ...s, sort: { key: a.key, dir } };
    }
    case "toggleTeam": return { ...s, filters: { ...s.filters, teamIds: toggleSet(s.filters.teamIds, a.id) } };
    case "toggleLocation": return { ...s, filters: { ...s.filters, locationIds: toggleSet(s.filters.locationIds, a.id) } };
    case "setSet": return { ...s, filters: { ...s.filters, setId: a.id } };
    case "toggleAttr": return { ...s, filters: { ...s.filters, [a.key]: !s.filters[a.key] } };
    case "clearFilters": return { ...s, filters: EMPTY_FILTERS, search: "" };
    case "search": return { ...s, search: a.value };
    case "applyConfig": return { ...s, ...a.state };
    case "valueMode": return { ...s, valueMode: s.valueMode === "current" ? "estimated" : "current" };
    case "viewing": return { ...s, viewingId: a.id };
    case "editing": return { ...s, editingId: a.id };
    case "patchRow": return { ...s, rows: s.rows.map((r) => (r.i === a.id ? { ...r, ...a.patch } : r)) };
    case "removeRow": return { ...s, rows: s.rows.filter((r) => r.i !== a.id) };
    default: return s;
  }
}

interface CollectionCtx extends State {
  collectorId: number;
  publicMode: boolean;   // read-only shared view: no fetch/cache/edit, values hidden
  shareToken: string | null;  // public mode: authorizes the public photo fetch
  visibleRows: CompactRow[];
  stats: ReturnType<typeof computeStats>;
  teams: ReturnType<typeof teamFacets>;
  sets: ReturnType<typeof setFacets>;
  viewingRow: CompactRow | null;
  editingRow: CompactRow | null;
  dispatch: React.Dispatch<Action>;
  // optimistic helpers
  patchRow: (id: number, patch: Partial<CompactRow>) => void;
  removeRow: (id: number) => void;
  setLocations: (locations: LocationRow[]) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<CollectionCtx | null>(null);

export function CollectionProvider({
  collectorId, children, initialRows, publicMode = false, initialView, initialSort, shareToken = null,
}: {
  collectorId: number;
  children: ReactNode;
  initialRows?: CompactRow[];     // public mode: seed rows instead of fetching
  publicMode?: boolean;
  initialView?: ViewMode;
  initialSort?: SortState;        // public mode: seed the saved view's sort
  shareToken?: string | null;     // public mode: token authorizing the photo fetch
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL, (init) => {
    // Public mode: start ready with the supplied rows; never touch the owner cache.
    if (initialRows) return { ...init, rows: initialRows, status: "ready" as const, view: initialView ?? init.view, sort: initialSort ?? init.sort };
    const cached = getCachedRows(collectorId);
    return cached ? { ...init, rows: cached, status: "ready" as const } : init;
  });

  const lastLoadRef = useRef(0);

  const load = useCallback(async (force: boolean) => {
    try {
      const warm = getCachedRows(collectorId);
      // Always refresh locations/agencies; only refetch the big index when cold or forced.
      const [rows, locations, agencies] = await Promise.all([
        warm && !force ? Promise.resolve(warm) : loadCollectionIndex(),
        loadLocations(),
        loadAgencies(),
      ]);
      lastLoadRef.current = Date.now();
      setCachedRows(collectorId, rows);
      dispatch({ t: "data", rows, locations, agencies });
    } catch (e) {
      dispatch({ t: "status", status: "error", error: (e as Error).message });
    }
  }, [collectorId]);

  useEffect(() => { if (!publicMode) void load(false); }, [load, publicMode]);

  // Auto-refresh when the app regains focus (e.g. you edited on another device,
  // then switched back here). Debounced by staleness so rapid tab-switches don't
  // refetch the ~750KB index repeatedly. (Owner only — public rows are static.)
  useEffect(() => {
    if (publicMode) return;
    const maybeRefresh = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoadRef.current > 15_000) void load(true);
    };
    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [load, publicMode]);

  // Keep the session singleton in sync after optimistic edits. Never in public
  // mode — the viewer isn't the owner, and the key would clobber their own cache.
  useEffect(() => { if (!publicMode && state.status === "ready") syncCachedRows(collectorId, state.rows); }, [state.rows, state.status, collectorId, publicMode]);

  // Deep link: /collection?view=<userCardId> opens that card's full-screen
  // viewer once the index includes it (e.g. arriving from a catalog card page's
  // "In your collection"). useSearchParams (not window.location) so it fires even
  // when Next keeps this page mounted across navigations; handledViewRef tracks
  // the value so a new ?view re-opens but the same one doesn't loop.
  const searchParams = useSearchParams();
  const handledViewRef = useRef<string | null>(null);
  useEffect(() => {
    if (publicMode || state.status !== "ready") return;
    const view = searchParams.get("view");
    if (!view || handledViewRef.current === view) return;
    const id = Number(view);
    if (Number.isFinite(id) && state.rows.some((r) => r.i === id)) {
      handledViewRef.current = view;
      dispatch({ t: "viewing", id });
    }
  }, [state.status, state.rows, searchParams, publicMode]);

  const deferredSearch = useDeferredValue(state.search);
  const visibleRows = useMemo(
    () => runPipeline(state.rows, state.filters, deferredSearch, state.sort),
    [state.rows, state.filters, deferredSearch, state.sort],
  );
  const stats = useMemo(() => computeStats(visibleRows, state.valueMode), [visibleRows, state.valueMode]);
  const teams = useMemo(() => teamFacets(state.rows), [state.rows]);
  const sets = useMemo(() => setFacets(state.rows), [state.rows]);
  const editingRow = useMemo(
    () => (state.editingId == null ? null : state.rows.find((r) => r.i === state.editingId) ?? null),
    [state.editingId, state.rows],
  );
  const viewingRow = useMemo(
    () => (state.viewingId == null ? null : state.rows.find((r) => r.i === state.viewingId) ?? null),
    [state.viewingId, state.rows],
  );

  const value: CollectionCtx = {
    ...state, collectorId, publicMode, shareToken, visibleRows, stats, teams, sets, viewingRow, editingRow, dispatch,
    patchRow: useCallback((id, patch) => dispatch({ t: "patchRow", id, patch }), []),
    removeRow: useCallback((id) => dispatch({ t: "removeRow", id }), []),
    setLocations: useCallback((locations) => dispatch({ t: "locations", locations }), []),
    reload: useCallback(async () => { if (!publicMode) await load(true); }, [load, publicMode]),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollection(): CollectionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCollection must be used within CollectionProvider");
  return ctx;
}
