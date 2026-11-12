import type { Metadata } from "next";
import { setsIndex } from "@/lib/catalog/queries";
import { SetsBrowser } from "@/components/catalog/sets-browser";

export const metadata: Metadata = { title: "Sets" };
export const instant = false; // live catalog read

export default async function SetsPage() {
  const sets = await setsIndex();
  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <h1 className="font-display text-2xl text-ink">Sets</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Search every release, filter by sport.</p>
      <SetsBrowser sets={sets} />
    </main>
  );
}
