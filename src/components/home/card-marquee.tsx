import { Suspense } from "react";
import { MarqueeCard } from "@/components/home/marquee-card";
import { getHomeShowcase } from "@/lib/home-showcase";

// The "giant database" statement: a continuous river of real card scans across
// eras. The row is a random per-load selection (one card per player — see
// lib/showcase), kept small so it's not dozens of image requests, duplicated
// once for a seamless loop. Edges fade via a mask. Raw (ungraded) cards only.
async function Strip() {
  const { marquee: cards } = await getHomeShowcase();
  const strip = [...cards, ...cards];
  return (
    <div className="animate-carousel flex w-max items-center gap-2.5 px-3">
      {strip.map((card, i) => (
        <MarqueeCard key={`${card.cardId}-${i}`} card={card} height={100} />
      ))}
    </div>
  );
}

export function CardMarquee() {
  return (
    <section aria-label="A sample of cards from the database" className="py-6">
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)]">
        {/* Fallback reserves the row height so the shell doesn't shift. */}
        <Suspense fallback={<div className="h-[100px]" />}>
          <Strip />
        </Suspense>
      </div>
    </section>
  );
}
