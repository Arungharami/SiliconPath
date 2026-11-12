# Practice track: Logic → CMOS

Status: implemented November 5, 2026 (v1.5.0). Content is original; faculty review pending.

## Problem
Before this track, SiliconPath learning paths offered short readings, one multiple-choice question per path and a self-reported "I completed this stage" checkbox. Nothing on the site let a learner practice engineering reasoning or produce evidence that they can do it.

Of three candidates considered in the November 2026 audit, this was ranked highest for impact against effort:

| Candidate | Impact | Effort | Decision |
| --- | --- | --- | --- |
| A. No feedback on practical reasoning; progress is self-reported | High | Medium | **Selected** |
| B. No bridge from fundamentals to RTL/simulation/synthesis with open-source EDA | High | High (toolchain install or WebAssembly) | Next track |
| C. Learner and institutional audiences share one navigation; overlap with the separate Semiconductor Pilot Hub | Medium | Low | Partly addressed: planning pages grouped under "Educators & labs" |

## Who it is for
- **Beginning EE/CE student** who has seen logic gates and wants to understand how transistors implement them.
- **Self-taught learner** who wants feedback without an instructor and an artifact to show what they practiced.
- **Instructor** evaluating whether an activity is usable in a course (the portfolio shows answers, attempts and criteria).

## What it does
Five modules, nine exercises: truth tables → expressions → sum-of-products minimization → MOSFET switches and the CMOS inverter → static CMOS NAND/NOR → AOI/OAI complex gates. Each module has objectives, prerequisites, an explanation, a worked example, an engineering application, auto-checked exercises and references.

### Checking
- Expressions are parsed by a hand-written recursive-descent parser (no `eval`). Precedence: NOT > AND > XOR > OR; implicit AND by adjacency; postfix `'` or prefix `!` for NOT.
- Every check is exhaustive over all input combinations (at most 16 rows), so feedback is exact and gives a concrete counterexample.
- SOP exercises also check form and literal count. A unit test proves by brute force that each literal limit equals the true minimum.
- Transistor exercises evaluate a pull-up (PMOS) and pull-down (NMOS) network at switch level and report contention (both conduct), floating outputs (neither conducts), wrong outputs and transistor count, with a generated schematic and per-row simulation table.

### Evidence
- `localStorage` key `sp-practice` stores attempts, timestamps, latest answer and the first passing answer per exercise.
- Pass status is recomputed by the checker from the stored passing answer whenever records load or are imported, so editing storage or a backup cannot create a pass.
- Learners can export a Markdown portfolio (answers, attempts, criteria, references, model limitations). Records are included in the study-desk JSON backup and restored from it.

## Decisions
1. **No backend.** Evidence stays in the browser, consistent with the existing privacy model. Shared or instructor-verified submissions would require accounts and a data-protection decision; not justified yet.
2. **Switch-level model, not SPICE.** It is exact for the logic question being asked, runs instantly in the browser and is honest about its scope. Every transistor page states the limitation.
3. **Exhaustive checking over randomized tests.** Input spaces are tiny, so exhaustive checking is cheaper and gives certainty.
4. **No new runtime dependencies.** One additional static script (`practice.js`).

## Acceptance criteria and results
| Criterion | Result (Nov 5, 2026) |
| --- | --- |
| Each exercise accepts its reference solution | Pass (unit test) |
| Adversarial wrong answers rejected with specific feedback (floating, contention, non-SOP, excess literals/transistors, out-of-scope inputs, syntax) | Pass (unit test, 15 cases) |
| Literal limits equal the true minimum | Pass (brute-force unit test) |
| Forged or malformed imported records cannot create a pass | Pass (unit test) |
| Full browser journey: fail → fix (keyboard) → reload → export → backup → clear → restore | Pass (Playwright) |
| No console/CSP errors; no horizontal overflow at 375px; no serious/critical axe violations, including with results displayed | Pass (Playwright + axe-core) |
| Every module cites at least one source that exists in the catalog | Pass (unit test); URLs verified to respond on Nov 5, 2026 |

## Limitations
- The switch-level model ignores threshold voltage, sizing, delay, power, noise margins and leakage.
- Evidence is self-hosted practice evidence, not an assessment or credential; a learner could share answers.
- Only combinational, static CMOS logic is covered. Sequential logic, timing and layout are out of scope.
- Automated accessibility rules cover a subset of WCAG; no screen-reader user testing has been done.
- Explanations are original summaries; full-content and faculty review of the cited sources is pending.

## Possible next steps
- Track B: an RTL → simulation → synthesis workflow using open-source tools (for example Icarus Verilog and Yosys), run locally with reproducible scripts.
- Pass/fail analytics only with consent and a privacy review.
- Instructor-defined exercises in the same data format.
