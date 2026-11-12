import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicView, publicCardToRow } from "@/lib/public-view";
import { PublicCollection } from "@/components/collection/public-collection";

export const instant = false; // per-owner public data; owner-preview differs from anon

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

  return (
    <PublicCollection
      rows={cards.map(publicCardToRow)}
      initialView={view.view_mode}
      initialSort={view.sort}
      shareToken={token}
      meta={{
        title: view.name,
        subtitle: "A live view",
        ownerUsername: view.owner_username,
        ownerLabel: view.owner_display ?? "a collector",
        truncated,
      }}
    />
  );
}
