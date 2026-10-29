import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Thumb-zone anchor: always-reachable at the bottom of the viewport, with iOS
// safe-area padding. Primary = create account; secondary = sign in.
export function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-base/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-sm items-center gap-2.5 p-3">
        <Link
          href="/auth/signup"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand to-[#7aa6ff] py-3.5 font-display text-[15px] font-bold tracking-tight text-base shadow-[0_8px_24px_-6px_rgba(91,146,255,0.6)] transition active:scale-[0.98]"
        >
          Start collecting — free
          <ArrowRight className="size-[18px]" aria-hidden />
        </Link>
        <Link
          href="/auth/login"
          className="rounded-full border border-white/12 px-5 py-3.5 text-[15px] font-medium text-ink transition active:scale-[0.98]"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
