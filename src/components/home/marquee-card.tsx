"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ShowcaseCard } from "@/data/showcase-cards";

// A carousel card with FIXED height and width derived from the image's real
// aspect ratio — so landscape and portrait scans share one height and simply
// differ in width (no cropping). We can't know the aspect before the bytes
// arrive, so we default to portrait 5:7 and correct it on load via
// naturalWidth/naturalHeight. The strip is duplicated for the loop, so both
// halves resize identically and the seamless -50% animation stays aligned.
export function MarqueeCard({ card, height = 100 }: { card: ShowcaseCard; height?: number }) {
  const [ar, setAr] = useState(5 / 7); // width / height

  return (
    <Link
      href={card.href}
      aria-label={`${card.player} — ${card.series}`}
      className="relative block shrink-0 overflow-hidden border border-white/15 bg-white/5 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.8)] ring-1 ring-inset ring-white/10"
      style={{ height, width: Math.round(height * ar) }}
    >
      <Image
        src={card.image}
        alt={`${card.player} — ${card.year} ${card.series} #${card.number}`}
        fill
        sizes="160px"
        className="object-cover"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) setAr(img.naturalWidth / img.naturalHeight);
        }}
      />
      {/* faint top-left gloss — reads as a physical, held card */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent" />
    </Link>
  );
}
