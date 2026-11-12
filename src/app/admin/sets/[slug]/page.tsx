import Link from "next/link";
import { notFound } from "next/navigation";
import { getSetBySlug, listSeriesForSet } from "@/lib/catalog/queries";
import { NewSeriesForm } from "@/components/admin/new-series-form";

export const instant = false;

export default async function AdminSetDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const set = await getSetBySlug(slug);
  if (!set) notFound();
  const series = await listSeriesForSet(set.set_id);

  return (
    <main>
      <Link href="/admin/sets" className="text-xs text-muted hover:text-ink">‹ Sets</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">{set.name}</h1>
        <span className="text-sm text-muted">{set.year ?? "—"} · {series.length} series</span>
      </div>

      <div className="mt-4"><NewSeriesForm setId={set.set_id} /></div>

      <div className="mt-4 flex flex-col divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
        {series.map((se) => (
          <Link key={se.series_id} href={`/admin/series/${se.slug}`} className="flex items-center justify-between bg-white/[0.03] px-4 py-3 text-sm transition hover:bg-white/[0.07]">
            <span className="truncate text-ink">{se.name}{se.is_base ? <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted">BASE</span> : null}</span>
            <span className="shrink-0 text-xs text-muted">{se.card_count ?? 0} cards ›</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
