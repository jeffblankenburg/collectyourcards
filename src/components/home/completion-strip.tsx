import Image from "next/image";
import { SHOWCASE_CARDS } from "@/data/showcase-cards";

// Illustrates the collecting loop — owned cards fill in, gaps remain to chase.
// Deliberately generic: no set name, no percentage, no counts, because we can't
// honestly back those yet. Real set-completion (a user's real progress on one
// real set) replaces this in the collections phase. Cards shown are real, raw.
const SLOTS = 18;
const FILLED = 14;
const FILLED_CARDS = SHOWCASE_CARDS.slice(0, FILLED);

export function CompletionStrip() {
  return (
    <section className="mx-auto max-w-screen-sm px-4 py-10">
      <p className="font-mono text-[11px] tracking-[0.22em] text-gold uppercase">
        The chase
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-balance">
        Watch your sets fill in, card by card.
      </h2>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
        Track completion across every set you collect, and see exactly what
        you&apos;re still chasing.
      </p>

      <div className="mt-5 grid grid-cols-9 gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        {Array.from({ length: SLOTS }).map((_, i) =>
          i < FILLED ? (
            <div
              key={i}
              className="relative aspect-[5/7] overflow-hidden ring-1 ring-white/15"
            >
              <Image
                src={FILLED_CARDS[i].image}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
          ) : (
            <div
              key={i}
              className="aspect-[5/7] border border-dashed border-white/15"
            />
          ),
        )}
      </div>
    </section>
  );
}
