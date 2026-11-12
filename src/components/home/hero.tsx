import { CardFan } from "@/components/home/card-fan";
import { HomeSearch } from "@/components/home/home-search";

type Stat = { value: string; label: string };

export function Hero({ stats }: { stats: Stat[] }) {
  return (
    <section className="relative z-30 mx-auto max-w-screen-sm px-4 pt-6 pb-4">
      <CardFan />

      <p className="reveal mt-2 font-mono text-[11px] tracking-[0.22em] text-brand uppercase [animation-delay:60ms]">
        Sports Card Collection Manager
      </p>

      <h1 className="reveal mt-3 font-display text-[2.6rem] leading-[0.98] font-extrabold tracking-tight text-balance [animation-delay:120ms]">
        Every card.
        <br />
        Every set.
        <br />
        <span className="bg-gradient-to-r from-gold via-gold to-brand bg-clip-text text-transparent">
          Every checklist.
        </span>
      </h1>

      <p className="reveal mt-4 max-w-sm text-[15px] leading-relaxed text-muted [animation-delay:200ms]">
        Catalog what you own, chase what you don&apos;t, and find any card in
        seconds — from the couch or the card show.
      </p>

      {/* Instant as-you-type catalog search. relative z-50 keeps the dropdown
          above the later `reveal` siblings (stats row), which create their own
          z-0 stacking contexts via their transform animation. */}
      <div className="reveal relative z-50 mt-5 [animation-delay:280ms]">
        <HomeSearch />
      </div>

      {/* Tight stat row — mono figures, hairline dividers, no boxes */}
      <dl className="reveal mt-6 grid grid-cols-3 divide-x divide-white/8 text-center [animation-delay:360ms]">
        {stats.map((stat) => (
          <div key={stat.label} className="px-1">
            <dt className="sr-only">{stat.label}</dt>
            <dd className="font-mono text-xl font-bold tabular-nums text-ink">
              {stat.value}
            </dd>
            <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">
              {stat.label}
            </p>
          </div>
        ))}
      </dl>
    </section>
  );
}
