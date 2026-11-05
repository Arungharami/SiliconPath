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
    `${checks} browser checks passed (route renders in Chromium (desktop + 375px): no console/CSP errors, no horizontal overflow, one <h1>, no serious/critical axe WCAG 2.1 AA violations; plus the practice-track journey).`,
  );
