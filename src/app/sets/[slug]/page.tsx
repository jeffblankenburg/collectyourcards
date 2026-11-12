import Link from "next/link";
import { notFound } from "next/navigation";
import { getSetBySlug, listSeriesForSet } from "@/lib/catalog/queries";
import { SetSeriesList, type SeriesRow } from "@/components/catalog/set-series-list";

export const instant = false; // param + live catalog read

export default async function SetDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const set = await getSetBySlug(slug);
  if (!set) notFound();
  const series = (await listSeriesForSet(set.set_id)) as SeriesRow[];

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <Link href="/sets" className="text-xs text-muted hover:text-ink">‹ Sets</Link>
      <h1 className="mt-2 font-display text-2xl text-ink">{set.name}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{set.year ?? "—"} · {set.card_count ?? 0} cards</p>

      <SetSeriesList series={series} />
    </main>
  );
}
