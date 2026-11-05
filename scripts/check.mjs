import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scripts } from "./files.mjs";

// Syntax-check every shipped script listed in files.mjs.
const root = fileURLToPath(new URL("../", import.meta.url));
let failed = 0;
for (const f of scripts) {
  const r = spawnSync(process.execPath, ["--check", f], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) failed++;
}
if (failed) {
  console.error(`${failed} script(s) failed the syntax check.`);
  process.exitCode = 1;
} else console.log(`Syntax valid: ${scripts.length} scripts.`);
