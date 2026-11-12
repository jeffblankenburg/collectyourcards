import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile } from "@/lib/auth";
import { OnboardingForm } from "@/components/profile/onboarding-form";

export const metadata: Metadata = { title: "Welcome" };
export const instant = false; // per-user dynamic page

export default async function OnboardingPage() {
  await connection();
  const profile = await getProfile();
  if (!profile?.collector_id) redirect("/auth/login");

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-10">
      <h1 className="font-display text-2xl text-ink">Welcome to Collect Your Cards</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Tell us who you are and pick a username to get started.</p>
      <OnboardingForm />
    </main>
  );
}
