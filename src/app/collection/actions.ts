"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export interface AddState { ok?: boolean; error?: string }

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Short per-card label shown in the UI. Matches the legacy format: 4 mixed-case
// alphanumeric chars (not unique — it's a human-friendly tag, not a key).
function randomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Add a card to the signed-in user's collection. user_id is resolved server-side
// (never trusted from the client); RLS `with check` is the backstop.
export async function addCard(_prev: AddState, formData: FormData): Promise<AddState> {
  const profile = await getProfile();
  if (!profile?.collector_id) return { error: "Please sign in first." };

  const card_id = num(formData.get("card_id"));
  if (!card_id) return { error: "Missing card." };

  const supabase = await createClient();
  const { error } = await supabase.from("user_card").insert({
    user_id: profile.collector_id,
    card_id,
    serial_number: num(formData.get("serial_number")),
    grade: num(formData.get("grade")),
    grading_agency: num(formData.get("grading_agency")),
    user_location_id: num(formData.get("user_location_id")),
    purchase_price: num(formData.get("purchase_price")),
    estimated_value: num(formData.get("estimated_value")),
    notes: (String(formData.get("notes") ?? "").trim() || null),
    random_code: randomCode(),
    created: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/collection");
  return { ok: true };
}
