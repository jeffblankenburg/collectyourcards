// Loads the committed human decisions for gated constraints (the "pause & show me"
// contract). Fail-closed: migrate/finalize refuse to run if a gated constraint has
// no recorded decision.
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { ADDED_CONSTRAINTS, SYNTHETIC_FKS } from "./transform.js";

const here = dirname(fileURLToPath(import.meta.url));
export const decisionsPath = resolve(here, "..", "decisions.json");

export type DecisionKind = "enforce" | "skip" | "fix";
export interface Decision {
  decision: DecisionKind;
  fix?: string; // optional label pointing at a FIXES entry (defaults to the finding id)
  note?: string;
}
export type Decisions = Record<string, Decision>;

export function loadDecisions(): Decisions {
  if (!existsSync(decisionsPath)) return {};
  return JSON.parse(readFileSync(decisionsPath, "utf8")) as Decisions;
}

// Returns decisions, throwing (fail-closed) if any gated constraint is undecided.
export function requireDecisions(): Decisions {
  const decisions = loadDecisions();
  const gatedIds = [
    ...ADDED_CONSTRAINTS.filter((ac) => ac.gate === "gated").map((ac) => ac.id),
    ...SYNTHETIC_FKS.filter((fk) => fk.gate === "gated").map((fk) => fk.id),
  ];
  const missing = gatedIds.filter((id) => !decisions[id]);
  if (missing.length) {
    throw new Error(
      `No decision recorded for gated constraint(s): ${missing.join(", ")}.\n` +
      `  Run \`npm run audit\`, review audit-report.json, then create migration/decisions.json with\n` +
      `  an entry per gated id: { "<id>": { "decision": "enforce" | "skip" | "fix" } }.`
    );
  }
  return decisions;
}
