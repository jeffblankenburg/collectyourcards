"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { myProfileSettings } from "@/lib/profile";

// Public/auth routes a signed-in-but-not-onboarded user may still visit without
// being bounced to onboarding (public shares, their own onboarding, auth).
const EXEMPT = ["/onboarding", "/auth", "/v/", "/u/"];

// Requires a completed profile (first + last name + username) before using the
// app. For a signed-in user who hasn't finished onboarding, redirects to
// /onboarding. Non-visual; mounted once in the root layout.
export function OnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/" || EXEMPT.some((p) => pathname === p || pathname.startsWith(p))) return;
    let cancelled = false;
    const check = async () => {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;                       // signed out → no gate
      const s = await myProfileSettings();
      if (!cancelled && s && !s.onboarded) router.replace("/onboarding");
    };
    void check();
    return () => { cancelled = true; };
  }, [pathname, router]);

  return null;
}
