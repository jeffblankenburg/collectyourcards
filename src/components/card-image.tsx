import Image from "next/image";
import type { ShowcaseCard } from "@/data/showcase-cards";

// A framed real card scan. Rounded corners + chrome-ish edge + a faint top gloss
// so it reads as a physical, held card. Parent controls width (e.g. `w-28`);
// the 5:7 aspect box keeps it card-shaped.
export function CardImage({
  card,
  className,
  sizes = "160px",
  priority = false,
}: {
  card: ShowcaseCard;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative aspect-[5/7] overflow-hidden border border-white/15 bg-white/5 shadow-[0_18px_36px_-14px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/10 ${
        className ?? ""
      }`}
    >
      <Image
        src={card.image}
        alt={`${card.player} — ${card.year} ${card.series} #${card.number}`}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
      {/* faint top-left gloss */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent" />
    </div>
  );
}
