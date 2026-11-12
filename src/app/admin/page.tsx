import Link from "next/link";
import { Upload, Layers, User, Shield } from "lucide-react";

export const instant = false;

const tiles = [
  { href: "/admin/import", icon: Upload, title: "Import checklist", desc: "Paste or upload a set's checklist → review matches → add many cards at once." },
  { href: "/admin/sets", icon: Layers, title: "Sets & series", desc: "Create sets and series; browse and edit cards." },
  { href: "/admin/players", icon: User, title: "Players", desc: "Create and edit players." },
  { href: "/admin/teams", icon: Shield, title: "Teams", desc: "Create and edit teams." },
];

export default function AdminDashboard() {
  return (
    <main>
      <h1 className="font-display text-2xl text-ink">Catalog admin</h1>
      <p className="mt-1 text-sm text-muted">Add and edit catalog data. The fastest way to grow the catalog is the checklist importer.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.06]">
            <t.icon className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <div className="font-medium text-ink">{t.title}</div>
              <div className="text-xs text-muted">{t.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
