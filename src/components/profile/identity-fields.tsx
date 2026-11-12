"use client";

import { useState } from "react";
import { completeProfile } from "@/lib/profile";

// Reusable first/last/username form used by BOTH onboarding and settings, so
// the fields and validation never diverge. Calls profile_complete on submit.
export function IdentityFields({
  initial, submitLabel = "Save", onSaved,
}: {
  initial?: { first_name?: string | null; last_name?: string | null; username?: string | null };
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const [first, setFirst] = useState(initial?.first_name ?? "");
  const [last, setLast] = useState(initial?.last_name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      await completeProfile(first, last, username);
      setSaved(true); setTimeout(() => setSaved(false), 1500);
      onSaved?.();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const canSubmit = first.trim() && last.trim() && username.trim() && !busy;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" value={first} onChange={setFirst} placeholder="Shohei" />
        <Field label="Last name" value={last} onChange={setLast} placeholder="Ohtani" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Username</label>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
          <span className="text-muted">@</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            placeholder="yourhandle"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">3–30 chars: letters, numbers, underscore. Your profile: /u/{username || "yourhandle"}</p>
      </div>

      {error ? <p className="text-sm text-gold">{error}</p> : null}

      <button onClick={submit} disabled={!canSubmit}
        className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
        {saved ? "Saved" : submitLabel}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/70"
      />
    </div>
  );
}
