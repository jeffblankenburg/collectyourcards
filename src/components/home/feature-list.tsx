import {
  Search,
  Layers,
  MapPin,
  ListChecks,
  Share2,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

type Feature = { icon: LucideIcon; title: string; body: string };

const FEATURES: Feature[] = [
  {
    icon: Search,
    title: "Find any card",
    body: "Search by number, player, team, or set and add it in a tap.",
  },
  {
    icon: Layers,
    title: "Track your collection",
    body: "Serial, grade, value, and photos — organized your way.",
  },
  {
    icon: MapPin,
    title: "Locate every card",
    body: "Assign a physical spot so you always know where it is.",
  },
  {
    icon: ListChecks,
    title: "Build custom lists",
    body: "Chase lists that matter to you and watch them fill in.",
  },
  {
    icon: Share2,
    title: "Share your best",
    body: "Show off cards, lists, and your profile with friends.",
  },
  {
    icon: Smartphone,
    title: "Collect anywhere",
    body: "A full, fast experience that lives on your home screen.",
  },
];

export function FeatureList() {
  return (
    <section className="mx-auto max-w-screen-sm px-4 py-10">
      <h2 className="font-display text-2xl font-bold tracking-tight">
        Everything a collector needs
      </h2>

      <ul className="mt-5 divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-center gap-3.5 p-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/0">
              <Icon className="size-[18px] text-brand" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
