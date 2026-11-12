"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { myProfileSettings, setProfilePublic, setUsername, type ProfileSettings } from "@/lib/profile";

// Pick a @username and flip the profile public/private. The public profile lives
// at /u/<username> and needs a username before it can be shared.
export function ProfileSettingsForm() {
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const s = await myProfileSettings();
    setSettings(s);
    setName(s?.username ?? "");
  };
  useEffect(() => { void load(); }, []);

  const saveUsername = async () => {
    if (busy) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      await setUsername(name);
      await load();
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const togglePublic = async () => {
    if (!settings) return;
    // Can't be public without a handle (the /u/<username> route needs one).
    if (!settings.username) { setError("Pick a username first."); return; }
    setError(null);
    try { await setProfilePublic(!settings.is_public_profile); await load(); }
    catch (e) { setError((e as Error).message); }
  };

  if (!settings) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Username</label>
        <div className="flex items-center gap-2">
          <span className="text-muted">@</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            onKeyDown={(e) => { if (e.key === "Enter") void saveUsername(); }}
            placeholder="yourhandle"
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/70"
          />
          <button onClick={saveUsername} disabled={busy || !name.trim() || name === settings.username}
            className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted">3–30 chars: letters, numbers, underscore. Your profile will live at /u/{name || "yourhandle"}.</p>
      </div>

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
