"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/auth/actions";

// Hamburger drawer — the single home for navigation so the slim header stays
// uncluttered as more destinations land. Auth-aware (getSession + live
// onAuthStateChange); admin links appear only for admins. Only existing routes
// are linked (no /players, /teams, /about index pages yet).
const BROWSE = [
  { href: "/", label: "Home" },
  { href: "/sets", label: "Sets" },
  { href: "/search", label: "Search" },
];
const MINE = [
  { href: "/collection", label: "My cards" },
  { href: "/lists", label: "Lists & wantlists" },
  { href: "/completion", label: "Set completion" },
  { href: "/submissions", label: "My submissions" },
  { href: "/settings", label: "Profile & settings" },
];

export function NavMenu() {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authed) { setIsAdmin(false); return; }
    createClient().from("profiles").select("role").maybeSingle()
      .then(({ data }) => setIsAdmin((data as { role?: string } | null)?.role === "admin"));
  }, [authed]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const linkCls = "block rounded-xl px-3 py-2.5 text-sm text-ink transition hover:bg-white/5";
  const sectionCls = "px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted";

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu" className="-mr-1.5 rounded-full p-1.5 text-ink transition hover:text-brand">
        <Menu className="size-6" />
      </button>

      {open ? createPortal(
        // Portaled to <body>: the SiteHeader's `backdrop-blur` makes it the
        // containing block for position:fixed children, which would collapse
        // this overlay to the header's height (leaving the drawer background
        // covering only the top strip). Rendering at the body escapes that.
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <nav className="absolute right-0 top-0 flex h-full w-72 max-w-[82vw] flex-col border-l border-white/10 bg-base shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 p-4 [padding-top:calc(1rem+env(safe-area-inset-top))]">
              <span className="brand-wordmark text-base">Collect Your Cards</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-muted hover:text-ink"><X className="size-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-2" onClick={() => setOpen(false)}>
              <div className={sectionCls}>Browse</div>
              {BROWSE.map((l) => <Link key={l.href} href={l.href} className={linkCls}>{l.label}</Link>)}

              {authed ? (
                <>
                  <div className={sectionCls}>Your collection</div>
                  {MINE.map((l) => <Link key={l.href} href={l.href} className={linkCls}>{l.label}</Link>)}
                  {isAdmin ? (
                    <>
                      <div className={sectionCls}>Admin</div>
                      <Link href="/admin" className={linkCls}>Dashboard</Link>
                      <Link href="/admin/review" className={linkCls}>Review queue</Link>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="border-t border-white/5 p-2 [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))]">
              {authed === null ? null : authed ? (
                <form action={signOut}>
                  <button type="submit" className={`${linkCls} flex w-full items-center gap-2 text-muted`}><LogOut className="size-4" /> Sign out</button>
                </form>
              ) : (
                <Link href="/auth/login" onClick={() => setOpen(false)} className="block rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-semibold text-white">Sign in</Link>
              )}
            </div>
          </nav>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
