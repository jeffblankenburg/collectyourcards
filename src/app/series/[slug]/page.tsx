import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeriesBySlug, cardSearch } from "@/lib/catalog/queries";
import { SeriesCards } from "@/components/catalog/series-cards";

export const instant = false; // param + live catalog read

export default async function SeriesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();
  const set = Array.isArray(series.set) ? series.set[0] : series.set;
  const cards = await cardSearch({ seriesId: series.series_id, limit: 200 });

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      {set ? <Link href={`/sets/${set.slug}`} className="text-xs text-muted hover:text-ink">‹ {set.name}</Link> : null}
      <h1 className="mt-2 font-display text-2xl text-ink">{series.name}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        {set?.year ?? ""} · {series.card_count ?? cards.length} cards
        {series.print_run_display ? ` · ${series.print_run_display}` : ""}
      </p>

      <SeriesCards seriesId={series.series_id} initialCards={cards} />
    </main>
  );
}
