import { Search } from "lucide-react";
import { CardFan } from "@/components/home/card-fan";

type Stat = { value: string; label: string };

export function Hero({ stats }: { stats: Stat[] }) {
  return (
    <section className="mx-auto max-w-screen-sm px-4 pt-6 pb-4">
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

      {/* Real search entry → the catalog search page (wired in a later phase) */}
      <form
        action="/search"
        className="reveal mt-5 flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.06] py-2.5 pr-2.5 pl-4 backdrop-blur transition focus-within:border-brand/60 focus-within:bg-white/[0.09] [animation-delay:280ms]"
      >
        <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
        <input
          name="q"
          type="search"
          enterKeyHint="search"
          placeholder="Search cards, players, sets…"
          aria-label="Search the card database"
          className="w-full bg-transparent text-[15px] text-ink placeholder:text-muted/70 focus:outline-none"
        />
      </form>

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
