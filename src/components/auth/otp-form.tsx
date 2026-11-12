"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendOtp, verifyOtp, type AuthState } from "@/app/auth/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-2xl bg-brand text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

const initial: AuthState = { step: "phone" };

export function OtpForm() {
  const [state, action] = useActionState(
    (prev: AuthState, fd: FormData) => (prev.step === "phone" ? sendOtp(prev, fd) : verifyOtp(prev, fd)),
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.step === "phone" ? (
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Mobile number</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            placeholder="(555) 123-4567"
            defaultValue={state.phone ?? ""}
            className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-lg text-ink outline-none focus:border-brand"
          />
        </label>
      ) : (
        <>
          <input type="hidden" name="phone" value={state.phone} />
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">
              Enter the code texted to <span className="text-ink">{state.phone}</span>
            </span>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="••••••"
              className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-2xl tracking-[0.5em] text-ink outline-none focus:border-brand"
            />
          </label>
        </>
      )}

      {state.error ? <p className="text-sm text-gold">{state.error}</p> : null}
      <SubmitButton label={state.step === "phone" ? "Text me a code" : "Verify & sign in"} />
    </form>
  );
}
