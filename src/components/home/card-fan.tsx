import { CardImage } from "@/components/card-image";
import { SHOWCASE_CARDS } from "@/data/showcase-cards";

// The hero moment: three real, raw (ungraded) iconic cards fanned like a hand
// pulled from a pack — vintage (Clemente '59), the rookie (Griffey '89), modern
// color (Trout 2025). Wrapper owns the static fan transform; CardImage owns the
// float (see card-fan history / the tailwind-v4 transform note). Decorative.
const byId = (id: number) => SHOWCASE_CARDS.find((c) => c.cardId === id)!;

const FAN = [
  {
    key: "left",
    card: byId(56304), // Roberto Clemente — 1959 Topps
    float: "float-slow",
    transform: "translate(-72px, 22px) rotate(-15deg)",
    z: "z-0",
    extra: "brightness-95",
  },
  {
    key: "right",
    card: byId(1008448), // Mike Trout — 2025 Topps Archives Red Hot Foilboard
    float: "float-fast",
    transform: "translate(72px, 22px) rotate(15deg)",
    z: "z-0",
    extra: "brightness-95",
  },
  {
    key: "center",
    card: byId(904939), // Ken Griffey Jr — 1989 Upper Deck (the rookie)
    float: "float-med",
    transform: "rotate(-4deg)",
    z: "z-10",
    extra: "",
    priority: true,
  },
];

export function CardFan() {
  return (
    <div
      aria-hidden
      className="relative mx-auto grid h-56 w-full max-w-sm place-items-center overflow-hidden"
    >
      {/* glow puck behind the fan */}
      <div className="col-start-1 row-start-1 h-40 w-44 rounded-full bg-brand/25 blur-3xl" />

      {FAN.map((c) => (
        <div
          key={c.key}
          className={`col-start-1 row-start-1 ${c.z}`}
          style={{ transform: c.transform }}
        >
          <CardImage
            card={c.card}
            priority={c.priority}
            sizes={c.key === "center" ? "150px" : "112px"}
            className={`${c.float} ${c.key === "center" ? "w-36" : "w-28"} ${c.extra}`}
          />
        </div>
      ))}
    </div>
  );
}
