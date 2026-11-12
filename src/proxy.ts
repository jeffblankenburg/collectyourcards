import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed Middleware -> Proxy. Runs before each request to refresh the
// Supabase auth session cookie.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // everything except static assets / images
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
