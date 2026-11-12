import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeriesBySlug } from "@/lib/catalog/queries";
import { SeriesCardManager } from "@/components/admin/series-card-manager";

export const instant = false;

export default async function AdminSeriesDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();
  const set = Array.isArray(series.set) ? series.set[0] : series.set;

  return (
    <main>
      {set ? <Link href={`/admin/sets/${set.slug}`} className="text-xs text-muted hover:text-ink">‹ {set.name}</Link> : null}
      <h1 className="mt-2 font-display text-2xl text-ink">{series.name}</h1>
      <p className="mt-1 text-sm text-muted">Published checklist: {series.card_count ?? 0} cards</p>
      <div className="mt-5">
        <SeriesCardManager seriesId={series.series_id} />
      </div>
    </main>
  );
}
