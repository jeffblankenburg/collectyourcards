import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile } from "@/lib/auth";
import { ListsShell } from "@/components/lists/lists-shell";

export const metadata: Metadata = { title: "Lists" };
export const instant = false; // per-user dynamic page

export default async function ListsPage() {
  // Request-time boundary before getProfile() (Supabase JWT check uses Date.now()).
  await connection();
  const profile = await getProfile();
  if (!profile?.collector_id) redirect("/auth/login");
  return <ListsShell collectorId={profile.collector_id} />;
}
