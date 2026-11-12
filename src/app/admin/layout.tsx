import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Layouts don't honor `export const instant`; open a dynamic boundary so the
  // auth/profile read (which touches Date.now()) runs at request time, not prerender.
  await connection();
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="mx-auto max-w-screen-lg px-4 py-6">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin" className="font-display text-lg text-ink">Admin</Link>
        <span className="text-muted">/</span>
        <Link href="/admin/import" className="rounded-full px-3 py-1 text-muted hover:text-ink">Import</Link>
        <Link href="/admin/sets" className="rounded-full px-3 py-1 text-muted hover:text-ink">Sets</Link>
        <Link href="/admin/players" className="rounded-full px-3 py-1 text-muted hover:text-ink">Players</Link>
        <Link href="/admin/teams" className="rounded-full px-3 py-1 text-muted hover:text-ink">Teams</Link>
        <Link href="/admin/review" className="rounded-full px-3 py-1 text-muted hover:text-ink">Review</Link>
      </nav>
      {children}
    </div>
  );
}
