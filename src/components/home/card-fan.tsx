import { Suspense } from "react";
import Link from "next/link";
import { CardImage } from "@/components/card-image";
import { getHomeShowcase } from "@/lib/home-showcase";

// The hero moment: three real, raw (ungraded) cards fanned like a hand pulled
// from a pack. The cards are chosen at random per page load (one per player,
// portrait-only — see lib/showcase) and dropped into these fixed left/center/
// right slots. Wrapper owns the static fan transform; CardImage owns the float
// (see card-fan history / the tailwind-v4 transform note). Decorative.
const SLOTS = [
  {
    key: "left",
    float: "float-slow",
    transform: "translate(-72px, 22px) rotate(-15deg)",
    z: "z-0",
    extra: "brightness-95",
  },
  {
    key: "right",
    float: "float-fast",
    transform: "translate(72px, 22px) rotate(15deg)",
    z: "z-0",
    extra: "brightness-95",
  },
  {
    key: "center",
    float: "float-med",
    transform: "rotate(-4deg)",
    z: "z-10",
    extra: "",
    priority: true,
  },
] as const;

// Fixed-size stage (and its glow puck) so the Suspense fallback holds the exact
// layout while the per-request cards stream in — no shift.
function Stage({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative mx-auto grid h-56 w-full max-w-sm place-items-center overflow-hidden">
      <div
        aria-hidden
        className="col-start-1 row-start-1 h-40 w-44 rounded-full bg-brand/25 blur-3xl"
      />
      {children}
    </div>
  );
}

async function Fan() {
  const { fan: cards } = await getHomeShowcase();
  return (
    <Stage>
      {SLOTS.map((slot, i) => {
        const card = cards[i];
        if (!card) return null;
        return (
          <Link
            key={slot.key}
            href={card.href}
            aria-label={`${card.player} — ${card.series}`}
            className={`col-start-1 row-start-1 ${slot.z}`}
            style={{ transform: slot.transform }}
          >
            <CardImage
              card={card}
              priority={"priority" in slot ? slot.priority : undefined}
              sizes={slot.key === "center" ? "150px" : "112px"}
              className={`${slot.float} ${slot.key === "center" ? "w-36" : "w-28"} ${slot.extra}`}
            />
          </Link>
        );
      })}
    </Stage>
  );
}

export function CardFan() {
  return (
    <Suspense fallback={<Stage />}>
      <Fan />
    </Suspense>
  );
}
