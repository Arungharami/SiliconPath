# SiliconPath architecture

Updated: November 5, 2026. Describes the code as it is, not as proposed.

## Summary
SiliconPath is a dependency-free static single-page application. There is no backend, database, account system or third-party runtime request. Vercel serves the files copied into `dist/`.

```
index.html ──loads──▶ lab.js, guides.js, operations.js, packaging.js,
                      initiative.js, circuit.js, engineering.js,
                      practice.js, rtl-engine.js, rtl-synth.js,
                      rtl.js                                       (feature modules)
                      app.js                                       (router + core views, loads last)
app.js ──fetch──▶ resources.json (source catalog)
all modules ──▶ localStorage (browser-only learner state; export/restore as JSON)
```

## Modules
| File | Responsibility | Global |
| --- | --- | --- |
| `app.js` | Hash router, learning paths, library, planner, workspace, services, About; shared storage helper | — |
| `lab.js` | Conceptual 3D lab studio (SVG projection) | `window.LabStudio` |
| `guides.js` | Start page, equipment guidance, faculty curriculum map | `window.SiliconGuides` |
| `operations.js` | Lab operational study, setup phases, document templates | `window.LabOperations` |
| `packaging.js` | Packaging and PCB learning pilot | `window.PackagingPilot` |
| `initiative.js` | Course concept and future-labs proposal pages | `window.SiliconInitiative` |
| `circuit.js` | Digital logic gate lab | `window.CircuitLab` |
| `engineering.js` | Project catalog and code library | `window.EngineeringHub` |
| `practice.js` | Logic → CMOS practice track: expression parser, switch-level checker, evidence records | `window.PracticeTrack` |
| `rtl-engine.js` | Verilog subset parser, elaborator and cycle-based simulator; testbench generator | `window.RtlEngine` |
| `rtl-synth.js` | Generated data: real Yosys output for reference designs (`npm run synth:rtl`) | `window.RtlSynth` |
| `rtl.js` | RTL → Synthesis practice track: modules, checkers, waveforms, evidence, project bundle | `window.RtlTrack` |

Feature modules expose a `page()` function that returns HTML and a `bind()` function that attaches event handlers after rendering. `app.js` `render()` maps the first segment of `location.hash` to a page function. Hash routing works on any static host without rewrite rules.

## Data and state
- `resources.json`: source catalog; validated by `npm run check` (required fields, unique ids, HTTPS URLs, allowed formats and levels, ISO dates). Remote link availability is not checked.
- Learning paths, projects and lab models are JavaScript data objects inside their modules.
- `localStorage` keys: `sp-saved`, `sp-completed`, `sp-plan`, `sp-notes`, `sp-practice`, `sp-rtl`, `siliconpath-pilot-*`, and per-project notes. All reads are wrapped in `try/catch` and fall back to defaults. Data never leaves the browser except through user-initiated file export or an email draft the user sends.

## Build and tooling
- `scripts/files.mjs` is the single list of shipped files. `build.mjs` copies it to `dist/`, `serve.mjs` serves only those files, `check.mjs` syntax-checks the scripts, and a unit test verifies `index.html` loads exactly those scripts. Adding a module means adding it to `files.mjs` and `index.html`.
- `serve.mjs` applies the response headers declared in `vercel.json`, so Content-Security-Policy violations appear during development and browser tests.
- Dev dependencies only: Prettier (formatting), Playwright and axe-core (browser tests). Nothing is bundled into the site.

## Security model
- All interpolated text passes through an `esc()` HTML-escaping helper before insertion with `innerHTML`.
- CSP restricts scripts to same-origin files; inline event-handler attributes are not used (enforced by a unit test). Inline `style` attributes are permitted because generated markup sets dynamic widths and positions.
- No secrets, tokens or credentials exist in the repository or the client.

## Testing
| Command | What it verifies | Limits |
| --- | --- | --- |
| `npm run check` | Catalog schema, script syntax | No remote link check |
| `npm test` | Content and logic in a Node VM with stub DOM objects | Not a browser |
| `npm run test:rtl` | RTL engine output equals Icarus Verilog on every corpus/exercise design; latch inference equals Yosys; generated testbenches and project bundle run; committed netlist simulates correctly | Needs iverilog and yosys installed (CI installs them); covers the designs in the corpus and exercises, not every possible learner design |
| `npm run test:e2e` | Every route at 1280px and 375px in Chromium: console/CSP errors, horizontal overflow, one `<h1>`, axe WCAG 2.1 AA serious/critical rules | Automated accessibility rules catch a subset of issues; no screen-reader or manual review |

## Known constraints
- Modules communicate through `window` globals and custom events rather than ES modules; load order in `index.html` matters (`app.js` last).
- Rendering replaces `#main` on each route change, so per-page state must be re-bound in `bind()`.
- The test harness reaches internal functions by appending code to `app.js` source inside the VM.
