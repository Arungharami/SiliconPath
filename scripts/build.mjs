import { mkdir, copyFile, rm } from "node:fs/promises";
import { shipped } from "./files.mjs";

const root = new URL("../", import.meta.url),
  dest = new URL("dist/", root);
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const f of shipped) await copyFile(new URL(f, root), new URL(f, dest));
console.log(
  `Built dist/: ${shipped.length} files, dependency-free static application.`,
);
