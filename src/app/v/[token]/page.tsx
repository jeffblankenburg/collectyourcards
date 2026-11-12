import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicView } from "@/lib/public-view";
import { CardTile } from "@/components/catalog/card-tile";

export const instant = false; // per-owner public data; owner-preview vs anon differ

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const result = await getPublicView(token);
  return { title: result ? `${result.view.name} · Shared view` : "Shared view" };
}

export default async function SharedViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getPublicView(token);
  if (!result) notFound();
  const { view, cards, truncated } = result;
  const owner = view.owner_username
    ? <Link href={`/u/${view.owner_username}`} className="text-brand hover:underline">@{view.owner_username}</Link>
    : <span>{view.owner_display ?? "a collector"}</span>;

  return (
    <main className="mx-auto max-w-screen-md px-4 py-6">
      <h1 className="font-display text-2xl text-ink">{view.name}</h1>
      <p className="mt-1 text-sm text-muted">
        A live view of {owner}&apos;s collection · {cards.length}{truncated ? "+" : ""} cards
      </p>
      {view.is_owner && !view.is_public ? (
        <p className="mt-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
          Preview — this view is private. Make it public to share the link.
        </p>
      ) : null}

      <div className={`mt-5 ${view.view_mode === "gallery" ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex flex-col gap-2"}`}>
        {cards.map((c) => (
          <CardTile key={c.user_card_id} card={c} condition={c} />
        ))}
      </div>
      {cards.length === 0 ? <p className="mt-6 text-sm text-muted">No cards match this view right now.</p> : null}
      {truncated ? <p className="mt-4 text-center text-xs text-muted">Showing the first {cards.length} cards.</p> : null}
    </main>
  );
}
