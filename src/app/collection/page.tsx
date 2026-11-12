import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile } from "@/lib/auth";
import { CollectionShell } from "@/components/collection/collection-shell";

export const metadata: Metadata = { title: "My Collection" };
export const instant = false; // per-user dynamic page

export default async function CollectionPage() {
  // Open a request-time boundary before getProfile() — the Supabase client's JWT
  // expiry check uses Date.now(), which Next rejects during the prerender pass.
  await connection();
  const profile = await getProfile();
  if (!profile?.collector_id) redirect("/auth/login");
  return <CollectionShell collectorId={profile.collector_id} />;
}
