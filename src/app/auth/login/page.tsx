import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { OtpForm } from "@/components/auth/otp-form";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };
export const instant = false; // per-request (reads session cookie)

export default async function LoginPage() {
  // Request-time boundary before getUser() (Supabase JWT check uses Date.now()).
  await connection();
  // Already signed in? Go straight to the collection.
  if (await getUser()) redirect("/collection");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-screen-sm flex-col justify-center px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Sign in</h1>
      <p className="mt-2 text-muted">
        We&apos;ll text you a one-time code. No passwords, ever.
      </p>
      <div className="mt-8">
        <OtpForm />
      </div>
    </main>
  );
}
