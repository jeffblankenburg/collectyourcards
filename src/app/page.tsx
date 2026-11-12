import { Hero } from "@/components/home/hero";
import { CardMarquee } from "@/components/home/card-marquee";
import { FeatureList } from "@/components/home/feature-list";
import { CompletionStrip } from "@/components/home/completion-strip";
import { StickyCta } from "@/components/home/sticky-cta";
import { getDatabaseStats, formatStat } from "@/lib/stats";

export default async function HomePage() {
  const stats = await getDatabaseStats();
  const heroStats = [
    { value: formatStat(stats.cards), label: "Cards" },
    { value: formatStat(stats.players), label: "Players" },
    { value: formatStat(stats.teams), label: "Teams" },
  ];

  // The hero fan, marquee, and CTA each render their own dynamic (per-request)
  // content behind a Suspense boundary — so this shell still prerenders while
  // the cards reshuffle and the CTA reflects auth on every load.
  return (
    <>
      <Hero stats={heroStats} />
      <CardMarquee />
      <FeatureList />
      <CompletionStrip />
      <StickyCta />
    </>
  );
}
