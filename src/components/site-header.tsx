import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

// Slim public bar. Register lives in the sticky thumb-zone CTA, so the header
// only carries identity + a quiet Sign in.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-5 text-white" />
          <span className="brand-wordmark text-lg leading-none">
            Collect Your Cards
          </span>
        </Link>
        <Link
          href="/auth/login"
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
