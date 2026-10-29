// Brand icon: a simple white trading-card outline, ported from the legacy app's
// card icon. Square corners (real sports cards aren't rounded). Inherits color
// via currentColor — set text-white.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <rect
        x="3"
        y="0.75"
        width="10.5"
        height="14.5"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
      />
    </svg>
  );
}
