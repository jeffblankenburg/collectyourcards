import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile } from "@/lib/auth";
import { CompletionView } from "@/components/lists/completion-view";

export const metadata: Metadata = { title: "Set completion" };
export const instant = false; // per-user dynamic page

export default async function CompletionPage() {
  // Request-time boundary before getProfile() (Supabase JWT check uses Date.now()).
  await connection();
  const profile = await getProfile();
  if (!profile?.collector_id) redirect("/auth/login");
  return <CompletionView />;
}
