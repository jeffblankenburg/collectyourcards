import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  collector_id: number | null;
  display_name: string | null;
  phone: string | null;
  role: string;
}

// The signed-in auth user (or null). Reads the session cookie -> keep callers
// behind <Suspense> under cacheComponents.
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// The caller's profile row (identity bridge to the bigint collector_id). Null if
// signed out. RLS restricts this to the caller's own row.
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, collector_id, display_name, phone, role")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
}

// Normalize a user-typed phone to E.164 (US-friendly default). Accepts
// "+1 555 123 4567", "5551234567", "15551234567".
export function toE164(raw: string): string | null {
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.length >= 11 ? digits : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
