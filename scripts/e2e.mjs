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
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`\n${failures.length} browser check failure(s).`);
  process.exitCode = 1;
} else
  console.log(
    `${checks} route renders passed in Chromium (desktop + 375px): no console/CSP errors, no horizontal overflow, one <h1>, no serious/critical axe WCAG 2.1 AA violations.`,
  );
