"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toE164 } from "@/lib/auth";

export interface AuthState {
  step: "phone" | "code";
  phone?: string;
  error?: string;
}

// Step 1: send the SMS OTP (Twilio Verify, configured in the Supabase dashboard).
export async function sendOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const phone = toE164(String(formData.get("phone") ?? ""));
  if (!phone) return { step: "phone", error: "Enter a valid mobile number." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { step: "phone", phone, error: error.message };
  return { step: "code", phone };
}

// Step 2: verify the 6-digit code -> establishes the session, then into the app.
export async function verifyOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const phone = String(formData.get("phone") ?? "");
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 4) return { step: "code", phone, error: "Enter the code we texted you." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { step: "code", phone, error: error.message };
  redirect("/collection");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
