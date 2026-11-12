import { createClient } from "@supabase/supabase-js";

// Cookie-less anon client for PUBLIC catalog reads. Because it never touches
// cookies it is safe to call inside `use cache` and cached Server Components.
// RLS public-read policies allow the anon role to read catalog tables.
export const sbPublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
