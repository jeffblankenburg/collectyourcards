import { extract } from "./extract.js";
import { load } from "./load.js";
import { verify } from "./verify.js";

const phase = process.argv[2] ?? "all";

async function main() {
  switch (phase) {
    case "extract":
      await extract();
      break;
    case "load":
      await load();
      break;
    case "verify":
      await verify();
      break;
    case "all":
      await extract();
      await load();
      await verify();
      break;
    default:
      console.error(`Unknown phase "${phase}". Use: extract | load | verify | all`);
      process.exit(2);
  }
}

main().catch((e) => {
  console.error("\n💥 spike failed:\n", e?.message ?? e);
  process.exit(1);
});
