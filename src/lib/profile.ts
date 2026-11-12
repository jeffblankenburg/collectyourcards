"use client";

import { createClient } from "@/lib/supabase/client";

export interface ProfileSettings {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  is_public_profile: boolean;
  bio: string | null;
  avatar_url: string | null;
  onboarded: boolean;
}

export async function myProfileSettings(): Promise<ProfileSettings | null> {
  const { data, error } = await createClient().rpc("my_profile_settings");
  if (error) throw error;
  return (data as ProfileSettings) ?? null;
}

// Set first/last name AND username together (onboarding, and the settings save).
// Throws with a human message on invalid/taken input.
export async function completeProfile(firstName: string, lastName: string, username: string): Promise<void> {
  const { error } = await createClient().rpc("profile_complete", {
    p_first: firstName, p_last: lastName, p_username: username,
  });
  if (error) throw new Error(error.message);
}

export async function setProfilePublic(isPublic: boolean): Promise<void> {
  const { error } = await createClient().rpc("profile_set_public", { p_is_public: isPublic });
  if (error) throw new Error(error.message);
}
