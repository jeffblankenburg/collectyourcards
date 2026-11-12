import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Supabase client (Server Components, Server Actions, Route Handlers).
// cookies() is async in Next 16. In a Server Component the cookie store is
// read-only, so setAll is wrapped in try/catch — session refresh happens in
// proxy.ts, so that's expected and safe here.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component; proxy.ts handles refresh */
          }
        },
      },
    },
  );
}
