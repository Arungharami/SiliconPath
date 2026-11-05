#!/usr/bin/env node
// Cross-checks the SiliconPath RTL subset engine against real tools.
//
// For every corpus design and every exercise design (references, starters
// that compile, and bugged variants) this script:
//   1. computes outputs with the engine (exhaustive inputs, or a fixed
//      deterministic clocked run),
//   2. writes a self-checking testbench with those values as expectations,
//   3. runs it in Icarus Verilog and requires "PASS" with the same number of
//      checks, and
//   4. runs Yosys to confirm the design synthesizes and that latch inference
//      agrees with the engine.
// Usage: node scripts/rtl-crosscheck.mjs [--require-tools] [--write-synth]
// --write-synth regenerates rtl-synth.js (real Yosys output shown in Module 5).
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { corpus } from "./rtl-corpus.mjs";

const args = new Set(process.argv.slice(2));
const root = new URL("../", import.meta.url);
const memory = new Map();
const ctx = vm.createContext({
  console,
  TextEncoder,
  localStorage: {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => memory.set(k, String(v)),
  },
});
ctx.window = ctx;
for (const f of ["rtl-engine.js", "rtl-synth.js", "rtl.js"])
  try {
    vm.runInContext(await readFile(new URL(f, root), "utf8"), ctx, {
      filename: f,
    });
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
const E = ctx.RtlEngine;

function tool(cmd) {
  try {
    execFileSync(cmd, ["-V"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
const have = { iverilog: tool("iverilog"), yosys: tool("yosys") };
if (!have.iverilog || !have.yosys) {
  const msg = `Icarus Verilog and Yosys are required (found: iverilog ${have.iverilog}, yosys ${have.yosys}).`;
  if (args.has("--require-tools")) {
    console.error(msg);
    process.exit(1);
  }
  console.log(msg + " Skipping cross-check.");
  process.exit(0);
}
const version = (cmd, flag) =>
  execFileSync(cmd, [flag], { encoding: "utf8" }).split("\n")[0].trim();
console.log(version("iverilog", "-V"));
console.log(version("yosys", "-V"));

const hash = (s) =>
  [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// A deterministic clocked stimulus: reset held for the first cycle, then
// pseudo-random inputs (reset asserted again roughly one cycle in 16).
export function stimulusFor(design, clock, cycles = 40, seed = 1) {
  const rand = E.lcg(seed);
  const ins = E.ports(design, "input").filter((p) => p.name !== clock);
  return Array.from({ length: cycles }, (_, i) => {
    const row = {};
    for (const p of ins) {
      const r = BigInt(rand()) & ((1n << BigInt(p.width)) - 1n);
      row[p.name] =
        p.name === "rst" ? (i === 0 ? 1n : rand() % 16 === 0 ? 1n : 0n) : r;
    }
    return row;
  });
}

const dir = await mkdtemp(join(tmpdir(), "sp-rtl-"));
let failures = 0,
  checked = 0,
  totalChecks = 0;
const fail = (name, msg) => {
  failures++;
  console.error(`✗ ${name}: ${msg}`);
};

async function yosysLog(src, top, script) {
  const file = join(dir, "y.v");
  await writeFile(file, src);
  const r = spawnSync(
    "yosys",
    ["-q", "-p", `read_verilog ${file}; hierarchy -top ${top}; ${script}`],
    { encoding: "utf8" },
  );
  return { ok: r.status === 0, log: (r.stdout || "") + (r.stderr || "") };
}

async function crossCheck({
  name,
  src,
  top = "t",
  clock,
  latch,
  cycles,
  stimulus,
}) {
  let design;
  try {
    design = E.compile(src, top);
  } catch (e) {
    if (!(e instanceof E.RtlError)) throw e;
    if (latch) {
      if (!e.latch)
        return fail(name, `expected latch error, got: ${e.message}`);
      // Structural check (independent of log wording across versions):
      // after proc, the design must contain a latch cell ($dlatch, $adlatch, ...).
      const y = await yosysLog(src, top, "proc; select -assert-any t:$*latch*");
      if (!y.ok) return fail(name, "engine reports a latch but Yosys does not");
      checked++;
      return console.log(`✓ ${name}: latch reported by engine and Yosys`);
    }
    return fail(name, `engine rejected the design: ${e.message}`);
  }
  if (latch) return fail(name, "engine accepted a design expected to latch");
  const latchFree = await yosysLog(
    src,
    top,
    "proc; select -assert-none t:$*latch*",
  );
  if (!latchFree.ok)
    return fail(name, "Yosys inferred a latch the engine did not report");
  const y = await yosysLog(src, top, "synth -top " + top);
  if (!y.ok) return fail(name, "Yosys failed:\n" + y.log);
  const rows = clock
    ? E.runCycles(
        design,
        clock,
        stimulus || stimulusFor(design, clock, cycles, hash(name)),
      )
    : E.exhaustive(design);
  const tb = E.testbench({
    top,
    inputs: E.ports(design, "input").filter((p) => p.name !== clock),
    outputs: E.ports(design, "output"),
    clock,
    rows,
    vcd: false,
  });
  const expectChecks = rows.reduce(
    (s, r) => s + Object.values(r.outputs).filter((v) => v !== null).length,
    0,
  );
  await writeFile(join(dir, "design.v"), src);
  await writeFile(join(dir, "tb.v"), tb);
  let out;
  try {
    execFileSync(
      "iverilog",
      [
        "-g2005",
        "-o",
        join(dir, "sim"),
        join(dir, "design.v"),
        join(dir, "tb.v"),
      ],
      { stdio: "pipe" },
    );
    out = execFileSync("vvp", ["-n", join(dir, "sim")], { encoding: "utf8" });
  } catch (e) {
    return fail(name, "Icarus failed:\n" + (e.stderr || e.stdout || e.message));
  }
  if (!out.includes(`PASS: ${expectChecks} checks`))
    return fail(name, "engine and Icarus disagree:\n" + out.trim());
  checked++;
  totalChecks += expectChecks;
  console.log(`✓ ${name}: ${expectChecks} output checks agree with Icarus`);
}

const designs = [...corpus];
if (ctx.RtlTrack) designs.push(...ctx.RtlTrack.crossCheckDesigns());
for (const d of designs) await crossCheck(d);

if (ctx.RtlTrack) {
  // Every generated learner-facing testbench must run in Icarus.
  for (const t of ctx.RtlTrack.sampleTestbenches()) {
    await writeFile(join(dir, "design.v"), t.design);
    await writeFile(join(dir, "tb.v"), t.tb);
    try {
      execFileSync(
        "iverilog",
        [
          "-g2005",
          "-o",
          join(dir, "sim"),
          join(dir, "design.v"),
          join(dir, "tb.v"),
        ],
        { stdio: "pipe" },
      );
      const out = execFileSync("vvp", ["-n", join(dir, "sim")], {
        cwd: dir,
        encoding: "utf8",
      });
      if (!out.includes(t.expect))
        fail(t.name, `expected "${t.expect}", got:\n${out.trim()}`);
      else {
        checked++;
        console.log(
          `✓ ${t.name}: generated testbench runs in Icarus (${t.expect})`,
        );
      }
    } catch (e) {
      fail(t.name, "Icarus failed:\n" + (e.stderr || e.stdout || e.message));
    }
  }
}

if (ctx.RtlTrack) {
  // The downloadable project bundle must unzip and run end to end.
  const T = ctx.RtlTrack;
  const des = T.exercises.find((e) => e.id === "counter4");
  const vec = T.exercises.find((e) => e.id === "counter-vectors");
  T.submit(des.id, des.ref);
  T.submit(vec.id, vec.sample);
  const zipPath = join(dir, "bundle.zip");
  await writeFile(zipPath, T.zip(T.bundleFiles(), "counter4_project/"));
  const r = spawnSync(
    "sh",
    ["-c", `unzip -q -o bundle.zip && cd counter4_project && sh run.sh`],
    { cwd: dir, encoding: "utf8" },
  );
  const out = (r.stdout || "") + (r.stderr || "");
  if (
    r.status !== 0 ||
    !/PASS: \d+ checks/.test(out) ||
    !/Estimated number of transistors/.test(out)
  )
    fail("project-bundle", `run.sh did not pass:\n${out}`);
  else {
    checked++;
    console.log(
      `✓ project-bundle: unzips, simulates (${out.match(/PASS: \d+ checks/)[0]}) and synthesizes with the real tools`,
    );
  }
  T.reset();
}

if (ctx.RtlTrack && (args.has("--write-synth") || args.has("--verify-synth"))) {
  const { synthesize } = await import("./rtl-synth.mjs");
  const result = await synthesize(ctx, dir, args.has("--write-synth"));
  if (!result.ok) fail("rtl-synth", result.message);
  else console.log(`✓ rtl-synth: ${result.message}`);
}

await rm(dir, { recursive: true, force: true });
console.log(
  `\n${checked} designs/testbenches cross-checked, ${totalChecks} output values compared, ${failures} failure${failures === 1 ? "" : "s"}.`,
);
process.exitCode = failures ? 1 : 0;
