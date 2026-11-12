import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { NavMenu } from "@/components/nav-menu";

// Slim bar: brand on the left, everything else behind the hamburger menu so the
// header scales as destinations grow.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-base/70 backdrop-blur-xl [padding-top:env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-5 text-white" />
          <span className="brand-wordmark text-lg leading-none">
            Collect Your Cards
          </span>
        </Link>
        <NavMenu />
      </div>
    </header>
  );
}
