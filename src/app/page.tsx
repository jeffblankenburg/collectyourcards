import { Hero } from "@/components/home/hero";
import { CardMarquee } from "@/components/home/card-marquee";
import { FeatureList } from "@/components/home/feature-list";
import { CompletionStrip } from "@/components/home/completion-strip";
import { StickyCta } from "@/components/home/sticky-cta";

// Published catalog figures. TODO: wire to a /api/database-stats endpoint once
// the data layer lands (migration DB is ready) so these stay current.
const STATS = [
  { value: "793K", label: "Cards" },
  { value: "6,965", label: "Players" },
  { value: "135", label: "Teams" },
];

export default function HomePage() {
  return (
    <>
      <Hero stats={STATS} />
      <CardMarquee />
      <FeatureList />
      <CompletionStrip />
      <StickyCta />
    </>
  );
}
