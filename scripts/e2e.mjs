// Real-browser checks: every route at desktop and phone width, served by the
// dev server with production security headers. Fails on console errors (which
// include CSP violations), horizontal page overflow, missing/duplicate <h1>,
// and serious or critical axe-core accessibility violations.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const axeSource = await readFile(
  require.resolve("axe-core/axe.min.js"),
  "utf8",
);
const port = 5199 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}/`;

export const routes = [
  "home",
  "start",
  "learn",
  "path/foundations",
  "library",
  "circuit",
  "projects",
  "projects/temperature-monitor",
  "code",
  "code/mqtt-pseudocode",
  "labs",
  "packaging",
  "packaging/wire-bond-flip-chip",
  "operations",
  "initiative",
  "initiative/labs",
  "equipment",
  "faculty",
  "planner",
  "support",
  "about",
  "workspace",
  "practice",
  "practice/boolean",
  "practice/minimize",
  "practice/switches",
  "practice/cmos-gates",
  "practice/complex-gates",
  "rtl",
  "rtl/intro",
  "rtl/combinational",
  "rtl/verification",
  "rtl/simulation",
  "rtl/synthesis",
  "rtl/project",
  "does-not-exist",
];

const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((resolve, reject) => {
  server.stdout.once("data", resolve);
  server.once("exit", (code) => reject(new Error(`server exited ${code}`)));
});

const failures = [];
let checks = 0;
const fail = (msg) => failures.push(msg);
const browser = await chromium.launch();
try {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 375, height: 740 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    for (const route of routes) {
      const where = `${viewport.width}px #${route}`;
      errors.length = 0;
      await page.goto(base + "#" + route);
      await page.waitForSelector("main h1");
      await page.waitForTimeout(150);
      const info = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelectorAll("main h1").length,
      }));
      if (errors.length)
        fail(`${where}: console errors: ${errors.join(" | ")}`);
      if (info.overflow > 1)
        fail(`${where}: horizontal overflow of ${info.overflow}px`);
      if (info.h1 !== 1) fail(`${where}: expected one <h1>, found ${info.h1}`);
      if (viewport.width === 1280) {
        await page.evaluate(axeSource);
        const result = await page.evaluate(() =>
          window.axe.run(document, {
            runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          }),
        );
        for (const v of result.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact),
        ))
          fail(
            `${where}: axe ${v.id} (${v.impact}) on ${v.nodes.length} node(s): ${v.nodes
              .map(
                (n) =>
                  n.target.join(" ") +
                  (v.id === "color-contrast"
                    ? " [" +
                      (n.any[0]?.message || "")
                        .replace(/\s+/g, " ")
                        .slice(0, 140) +
                      "]"
                    : ""),
              )
              .slice(0, 3)
              .join("; ")}`,
          );
      }
      checks++;
    }
    await page.close();
  }
  await practiceJourney();
  await rtlJourney();
} finally {
  await browser.close();
  server.kill();
}

// Learner journey through the practice track: fail, fix, persist, export,
// back up, clear and restore the evidence record.
async function practiceJourney() {
  const expect = (cond, msg) => {
    checks++;
    if (!cond) fail(`practice journey: ${msg}`);
  };
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  const text = async (sel) =>
    (await page.locator(sel).first().textContent()) || "";
  const download = async (click) => {
    const [d] = await Promise.all([page.waitForEvent("download"), click()]);
    const chunks = [];
    for await (const c of await d.createReadStream()) chunks.push(c);
    return {
      name: d.suggestedFilename(),
      body: Buffer.concat(chunks).toString("utf8"),
    };
  };

  await page.goto(base + "#practice/cmos-gates");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const nand = page.locator('[data-exercise="nand2"]');
  await nand.locator("[data-pun]").fill("A*B");
  await nand.locator("[data-pdn]").fill("A*B");
  await nand.locator("[data-check]").click();
  let result = await nand.locator("[data-result]").textContent();
  expect(
    result.includes("Not yet.") && result.includes("Floating"),
    `wrong NAND not reported as floating: ${result}`,
  );
  expect(
    (await nand.locator("svg.practice-diagram").count()) === 1,
    "simulation diagram not drawn",
  );
  expect(
    (await nand.locator(".practice-row-bad").count()) === 2,
    "expected 2 highlighted failing rows",
  );

  await page.evaluate(axeSource);
  const axe = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    }),
  );
  const serious = axe.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact),
  );
  expect(
    !serious.length,
    `axe with results shown: ${serious.map((v) => v.id).join(", ")}`,
  );

  await nand.locator("[data-pun]").fill("A+B");
  await nand.locator("[data-pun]").press("Enter");
  result = await nand.locator("[data-result]").textContent();
  expect(
    result.includes("Passed."),
    `correct NAND not accepted via Enter: ${result}`,
  );
  expect(
    (await nand.locator("[data-badge]").textContent()).includes(
      "Passed · 2 attempts",
    ),
    "badge not updated",
  );
  expect(
    (await text("[data-module-count]")).startsWith("1 of 2"),
    "module progress not updated",
  );

  await page.setViewportSize({ width: 375, height: 740 });
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  expect(over <= 1, `results overflow ${over}px at 375px`);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.reload();
  expect(
    (
      await page.locator('[data-exercise="nand2"] [data-badge]').textContent()
    ).includes("Passed"),
    "pass did not persist across reload",
  );

  await page.goto(base + "#practice/boolean");
  const table = page.locator('[data-exercise="table-abc"]');
  const want = "01011101";
  for (let k = 0; k < want.length; k++)
    if (want[k] === "1") await table.locator(`[data-bit="${k}"]`).click();
  await table.locator("[data-check]").click();
  expect(
    (await table.locator("[data-result]").textContent()).includes("Passed."),
    "truth table exercise not passed",
  );

  await page.goto(base + "#practice");
  expect(
    (await text(".big-count")) === "2/9",
    `overview count ${await text(".big-count")}`,
  );
  const md = await download(() => page.click("[data-practice-export]"));
  expect(
    md.name.endsWith(".md") &&
      md.body.includes("2 of 9 exercises passed") &&
      md.body.includes("PUN = A+B; PDN = A*B"),
    "portfolio export content",
  );

  await page.goto(base + "#workspace");
  expect(
    (await page.locator("aside").textContent()).includes(
      "2/9 exercises passed",
    ),
    "study desk practice summary",
  );
  const backup = await download(() => page.click("#export-backup"));
  const json = JSON.parse(backup.body);
  expect(
    Boolean(json.practice?.records?.nand2?.passedAt),
    "backup lacks practice evidence",
  );

  await page.evaluate(() => localStorage.removeItem("sp-practice"));
  await page.goto(base + "#practice");
  expect((await text(".big-count")) === "0/9", "records not cleared");
  await page.goto(base + "#workspace");
  await page.setInputFiles("#import-backup", {
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup.body),
  });
  await page.waitForTimeout(300);
  await page.goto(base + "#practice");
  expect(
    (await text(".big-count")) === "2/9",
    "restore did not bring back practice evidence",
  );

  expect(!errors.length, `console errors: ${errors.join(" | ")}`);
  await ctx.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`\n${failures.length} browser check failure(s).`);
  process.exitCode = 1;
} else
  console.log(
    `${checks} browser checks passed (route renders in Chromium (desktop + 375px): no console/CSP errors, no horizontal overflow, one <h1>, no serious/critical axe WCAG 2.1 AA violations; plus the Logic → CMOS and RTL learner journeys).`,
  );

// Learner journey through the RTL track: compile error, functional failure
// with axe while results show, keyboard fix, clocked waveform, real Yosys
// netlist, exports, and backup/restore across both tracks.
async function rtlJourney() {
  const expect = (cond, msg) => {
    checks++;
    if (!cond) fail(`rtl journey: ${msg}`);
  };
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  const text = async (sel) =>
    (await page.locator(sel).first().textContent()) || "";
  const download = async (click) => {
    const [d] = await Promise.all([page.waitForEvent("download"), click()]);
    const chunks = [];
    for await (const c of await d.createReadStream()) chunks.push(c);
    return { name: d.suggestedFilename(), bytes: Buffer.concat(chunks) };
  };
  const axeSerious = async () => {
    await page.evaluate(axeSource);
    const axe = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      }),
    );
    return axe.violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map((v) => v.id);
  };
  const overflow375 = async () => {
    await page.setViewportSize({ width: 375, height: 740 });
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    return over;
  };

  await page.goto(base + "#rtl/combinational");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const ha = page.locator('[data-exercise="half-adder"]');
  const editor = ha.locator("[data-answer]");
  await editor.fill(
    "module half_adder (input wire a, output wire sum);\nassign sum = a +;\nendmodule",
  );
  await ha.locator("[data-check]").click();
  let result = await ha.locator("[data-result]").textContent();
  expect(
    result.includes("Line 2") &&
      (await ha.locator(".rtl-excerpt").count()) === 1,
    `compile error not located: ${result}`,
  );
  await editor.fill(
    "module half_adder (input wire a, input wire b, output wire sum, output wire carry);\n  assign sum = a | b;\n  assign carry = a & b;\nendmodule",
  );
  await ha.locator("[data-check]").click();
  result = await ha.locator("[data-result]").textContent();
  expect(
    result.includes("Not yet.") &&
      (await ha.locator(".practice-row-bad").count()) === 1,
    `functional bug not reported with one mismatch row: ${result}`,
  );
  let serious = await axeSerious();
  expect(!serious.length, `axe with results shown: ${serious.join(", ")}`);
  await editor.fill(
    "module half_adder (input wire a, input wire b, output wire sum, output wire carry);\n  assign sum = a ^ b;\n  assign carry = a & b;\nendmodule",
  );
  await editor.press("Control+Enter");
  result = await ha.locator("[data-result]").textContent();
  expect(
    result.includes("Passed."),
    `fix not accepted via Ctrl+Enter: ${result}`,
  );
  expect(
    (await ha.locator("[data-badge]").textContent()).includes(
      "Passed · 3 attempts",
    ),
    "badge not updated",
  );
  await editor.focus();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => document.activeElement?.matches("[data-check]")),
    "Tab is trapped in the editor",
  );

  await page.goto(base + "#rtl/simulation");
  const ff = page.locator('[data-exercise="dffe"]');
  await ff
    .locator("[data-answer]")
    .fill(
      "module dffe (input wire clk, input wire rst, input wire en, input wire d, output reg q);\n  always @(posedge clk)\n    if (en) q <= d;\n    else if (rst) q <= 1'b0;\nendmodule",
    );
  await ff.locator("[data-check]").click();
  result = await ff.locator("[data-result]").textContent();
  expect(
    result.includes("Not yet.") && /Cycle \d+/.test(result),
    `clocked bug not reported by cycle: ${result}`,
  );
  expect(
    (await ff.locator(".rtl-wave-svg").count()) === 1 &&
      (await ff.locator(".rtl-wave-mark").count()) === 1,
    "waveform with marked cycle not drawn",
  );
  serious = await axeSerious();
  expect(!serious.length, `axe with waveform shown: ${serious.join(", ")}`);
  const over = await overflow375();
  expect(over <= 1, `waveform overflows the page by ${over}px at 375px`);
  await ff
    .locator("[data-answer]")
    .fill(
      "module dffe (input wire clk, input wire rst, input wire en, input wire d, output reg q);\n  always @(posedge clk)\n    if (rst) q <= 1'b0;\n    else if (en) q <= d;\nendmodule",
    );
  await ff.locator("[data-check]").click();
  expect(
    (await ff.locator("[data-result]").textContent()).includes("Passed."),
    "correct flip-flop not accepted",
  );

  await page.goto(base + "#rtl/synthesis");
  expect(
    (await text(".rtl-wrap")).includes("Yosys output") &&
      (await page.locator(".rtl-code").first().textContent()).includes(
        "Generated by Yosys",
      ),
    "Yosys netlist panel missing",
  );
  const counts = await page.evaluate(() =>
    window.RtlTrack.netlistCounts(window.RtlSynth.designs.full_adder.netlist),
  );
  const nl = page.locator('[data-exercise="netlist-read"]');
  await nl.locator('[data-field="nand"]').fill(String(counts.nand));
  await nl.locator('[data-field="nor"]').fill(String(counts.nor));
  await nl.locator('[data-field="not"]').fill(String(counts.not));
  await nl.locator('[data-field="tr"]').fill(String(counts.transistors));
  await nl.locator('[data-field="tr"]').press("Enter");
  expect(
    (await nl.locator("[data-result]").textContent()).includes("Passed."),
    "netlist reading not accepted",
  );

  await page.goto(base + "#rtl");
  expect(
    (await text(".big-count")) === "3/13",
    `overview count ${await text(".big-count")}`,
  );
  const md = await download(() => page.click("[data-rtl-export]"));
  expect(
    md.name.endsWith(".md") &&
      md.bytes.toString("utf8").includes("3 of 13 exercises passed"),
    "portfolio export content",
  );
  const zip = await download(() =>
    page.locator("[data-rtl-bundle]").first().click(),
  );
  expect(
    zip.name.endsWith(".zip") && zip.bytes.subarray(0, 2).toString() === "PK",
    "project bundle is not a zip file",
  );
  const tb = await (async () => {
    await page.goto(base + "#rtl/combinational");
    return download(() =>
      page.locator('[data-exercise="half-adder"] [data-dl="tb"]').click(),
    );
  })();
  expect(
    tb.bytes.toString("utf8").includes("half_adder dut ("),
    "testbench download",
  );

  await page.goto(base + "#workspace");
  const aside = await page.locator("aside").textContent();
  expect(aside.includes("3/13 exercises passed"), "study desk RTL summary");
  const backup = await download(() => page.click("#export-backup"));
  const json = JSON.parse(backup.bytes.toString("utf8"));
  expect(
    Boolean(json.rtl?.records?.["half-adder"]?.passedAt) &&
      Boolean(json.practice),
    "backup lacks RTL or practice evidence",
  );
  await page.evaluate(() => localStorage.removeItem("sp-rtl"));
  await page.goto(base + "#rtl");
  expect((await text(".big-count")) === "0/13", "records not cleared");
  await page.goto(base + "#workspace");
  await page.setInputFiles("#import-backup", {
    name: "backup.json",
    mimeType: "application/json",
    buffer: backup.bytes,
  });
  await page.waitForTimeout(300);
  await page.goto(base + "#rtl");
  expect(
    (await text(".big-count")) === "3/13",
    "restore did not bring back RTL evidence",
  );

  expect(!errors.length, `console errors: ${errors.join(" | ")}`);
  await ctx.close();
}
