import { CardImage } from "@/components/card-image";
import { SHOWCASE_CARDS } from "@/data/showcase-cards";

// The "giant database" statement: a continuous river of real card scans across
// eras. A curated, varied subset (kept small so it's not dozens of image
// requests), duplicated once for a seamless loop. Edges fade via a mask.
// Raw (ungraded) cards only — no slabs.
const MARQUEE_IDS = [
  56304, 56340, 904939, 778554, 774428, 904963, 774367, 1008448, 913196,
  982525, 1006835, 1015178, 940708, 877582, 1014191, 982597,
];

const ROW = MARQUEE_IDS.map((id) => SHOWCASE_CARDS.find((c) => c.cardId === id)!).filter(Boolean);
const STRIP = [...ROW, ...ROW];

export function CardMarquee() {
  return (
    <section aria-label="A sample of cards from the database" className="py-6">
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)]">
        <div className="animate-carousel flex w-max gap-2.5 px-3">
          {STRIP.map((card, i) => (
            <CardImage
              key={`${card.cardId}-${i}`}
              card={card}
              sizes="88px"
              className="w-[72px] shrink-0 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.8)]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
