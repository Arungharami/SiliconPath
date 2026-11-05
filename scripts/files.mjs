// Single source of truth for the files that make up the static site.
// build.mjs copies these, serve.mjs serves only these, check.mjs syntax-checks
// the scripts, and test.mjs verifies index.html loads every script listed here.
export const scripts = [
  "lab.js",
  "guides.js",
  "operations.js",
  "packaging.js",
  "initiative.js",
  "circuit.js",
  "engineering.js",
  "app.js",
];

export const shipped = [
  "index.html",
  "styles.css",
  "resources.json",
  "favicon.svg",
  ...scripts,
];
