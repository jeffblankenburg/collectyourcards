"use client";

import { useRouter } from "next/navigation";
import { IdentityFields } from "./identity-fields";

// First run: collect name + username (required), then into the app.
export function OnboardingForm() {
  const router = useRouter();
  return (
    <IdentityFields submitLabel="Continue" onSaved={() => { router.replace("/collection"); router.refresh(); }} />
  );
}
