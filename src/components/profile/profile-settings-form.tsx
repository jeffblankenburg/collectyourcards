"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { myProfileSettings, setProfilePublic, type ProfileSettings } from "@/lib/profile";
import { IdentityFields } from "./identity-fields";

// Edit name + @username (shared IdentityFields) and flip the profile public.
export function ProfileSettingsForm() {
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => setSettings(await myProfileSettings());
  useEffect(() => { void load(); }, []);

  const togglePublic = async () => {
    if (!settings) return;
    if (!settings.username) { setError("Add your name and username first."); return; }
    setError(null);
    try { await setProfilePublic(!settings.is_public_profile); await load(); }
    catch (e) { setError((e as Error).message); }
  };

  if (!settings) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <IdentityFields initial={settings} submitLabel="Save profile" onSaved={load} />

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">Public profile</div>
          <div className="text-xs text-muted">Let anyone view your favorites and shared views.</div>
        </div>
        <button onClick={togglePublic}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings.is_public_profile ? "bg-brand" : "bg-white/15"}`}
          aria-pressed={settings.is_public_profile}>
          <span className={`absolute top-0.5 size-5 rounded-full bg-white transition ${settings.is_public_profile ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      {error ? <p className="text-sm text-gold">{error}</p> : null}

      {settings.username && settings.is_public_profile ? (
        <Link href={`/u/${settings.username}`} className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
          View your public profile <ExternalLink className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
