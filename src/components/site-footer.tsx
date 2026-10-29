import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const LINKS = [
  { label: "Players", href: "/players" },
  { label: "Teams", href: "/teams" },
  { label: "Sets", href: "/sets" },
  { label: "About", href: "/about" },
];

export async function SiteFooter() {
  "use cache";
  const year = new Date().getFullYear();

  return (
    // Bottom padding clears the fixed sticky CTA bar (plus iOS safe area).
    <footer className="border-t border-white/5 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-screen-sm px-4 py-8">
        <div className="flex items-center gap-2">
          <BrandMark className="size-4 text-white" />
          <span className="brand-wordmark text-sm">Collect Your Cards</span>
        </div>

        <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="mt-6 font-mono text-[11px] tracking-wide text-muted/70">
          © {year} COLLECT YOUR CARDS
        </p>
      </div>
    </footer>
  );
}
