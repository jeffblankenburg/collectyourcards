"use client";

import { createClient } from "@/lib/supabase/client";

export interface ProfileSettings {
  username: string | null;
  display_name: string | null;
  is_public_profile: boolean;
  bio: string | null;
  avatar_url: string | null;
}

export async function myProfileSettings(): Promise<ProfileSettings | null> {
  const { data, error } = await createClient().rpc("my_profile_settings");
  if (error) throw error;
  return (data as ProfileSettings) ?? null;
}

// Claim/replace the caller's @username. Throws with a human message on invalid
// or taken names (surfaced straight to the form).
export async function setUsername(username: string): Promise<string> {
  const { data, error } = await createClient().rpc("profile_set_username", { p_username: username });
  if (error) throw new Error(error.message);
  return (data as { username: string }).username;
}

export async function setProfilePublic(isPublic: boolean): Promise<void> {
  const { error } = await createClient().rpc("profile_set_public", { p_is_public: isPublic });
  if (error) throw new Error(error.message);
}
