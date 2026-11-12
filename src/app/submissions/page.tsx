import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile } from "@/lib/auth";
import { MySubmissionsShell } from "@/components/submissions/my-submissions-shell";

export const metadata: Metadata = { title: "My submissions" };
export const instant = false; // per-user dynamic page

export default async function SubmissionsPage() {
  // Request-time boundary before getProfile() (Supabase JWT check uses Date.now()).
  await connection();
  const profile = await getProfile();
  if (!profile?.collector_id) redirect("/auth/login");
  return <MySubmissionsShell collectorId={profile.collector_id} />;
}
