import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile } from "@/lib/auth";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";

export const metadata: Metadata = { title: "Settings" };
export const instant = false; // per-user dynamic page

export default async function SettingsPage() {
  await connection();
  const profile = await getProfile();
  if (!profile?.collector_id) redirect("/auth/login");

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <h1 className="font-display text-2xl text-ink">Settings</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Your public profile and sharing.</p>
      <ProfileSettingsForm />
    </main>
  );
}
