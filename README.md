![SiliconPath — Learn, plan, contribute](assets/siliconpath-banner.svg)

# SiliconPath
**Semiconductor Learning & Lab Development**

[Visit SiliconPath](https://siliconpath-six.vercel.app/) · [About & mission](https://siliconpath-six.vercel.app/#about) · [Services](https://siliconpath-six.vercel.app/#support) · [Project charter](docs/PROJECT_CHARTER.md) · [Contribute](CONTRIBUTING.md)

Created and curated by [Arun Kumar Gharami](https://www.arungharami.info/).

## Course concept and future labs
[Explore the digital development plan](https://siliconpath-six.vercel.app/#initiative) · [Course proposal](docs/FAU_COURSE_CONCEPT.md) · [Two-lab master plan](docs/SILICONPATH_MASTER_PLAN.md)

The October 15 expansion separates a possible FAU teaching concept for faculty discussion from Arun’s proposed digital platform and future two-lab development. Includes an illustrative eight-block sequence, assessment proposal, team and office model, phased resource planning and a downloadable brief. No course approval, lab operation, partnership or funding is claimed.

Project display name: SiliconPath — Semiconductor Learning & Lab Development. Canonical repository name: SiliconPath. Existing repository and deployment identities are retained.

## Mission
Connect credible semiconductor learning with practical planning, digital tools and voluntary project support so learners and project teams can make informed decisions.

## Vision
A pathway from curiosity to capability: more learners and institutions developing semiconductor knowledge, supervised practical skills and well-documented projects.

## What you can use today
- **Logic → CMOS practice track:** five modules and nine auto-checked exercises, from truth tables to transistor-level CMOS gate design, with an exportable evidence portfolio. See [design notes](docs/practice-track.md).
- **RTL → Simulation → Synthesis practice track:** six modules and 13 auto-checked exercises. Learners write Verilog in the browser (checked by SiliconPath's subset engine, cross-checked against Icarus Verilog), write test vectors that must catch bugged designs, read waveforms and real Yosys netlists, and download a 4-bit counter project that runs with Icarus Verilog and Yosys. See [design notes](docs/rtl-track.md).
- Six guided learning paths and a curated catalog of 35 starting resources.
- Interactive micro, medium and large conceptual lab models.
- Equipment guidance, curriculum mapping and user-entered budget scenarios.
- Operational planning studies, blank documentation templates and downloadable briefs.
- Browser-local study notes, reading lists, workspace export and restore.
- A volunteer services portfolio, inquiry brief and email-draft workflow.

## Services and tangible outputs
| Service | Output |
| --- | --- |
| Project readiness | Scoped brief, requirements register and open questions |
| Facility and workflow support | Concept workflow, space inventory and specialist-review agenda |
| Equipment and supplier research | Comparison matrix, shortlist and quote register |
| Workforce preparation | Training roadmap, activity worksheets and reviewer-approved assessment criteria |
| Setup coordination | Action tracker, decision records and milestone report |
| Digital tools and research | Bounded demonstration, source files, documentation and handover |

Volunteer availability, deliverables, external costs, permissions and reviewers are agreed per engagement. Engineering design, process settings, installation, commissioning and safety approval remain with qualified specialists and the responsible host.

## Project status and evidence
This is a working independent educational platform and a proposed volunteer service initiative. Public commits and source code show what has been implemented; they do not establish accreditation, institutional endorsement or production readiness.

- Automated checks: catalog and syntax validation, 74 Node VM content/logic checks, an RTL cross-check against Icarus Verilog and Yosys (80 designs and testbenches), and a Chromium browser suite covering every route plus learner journeys for both practice tracks at desktop and 375px width (console/CSP errors, horizontal overflow, axe WCAG 2.1 AA serious/critical rules). All run in CI. Manual screen-reader review has not been performed.
- Source descriptions summarize listings; full-content and faculty review are pending.
- Detailed Vivo-related warehouse and volunteer project case studies require exact roles, dates, permitted names and supporting evidence.
- The maintainer supplied the GitHub organization name SiliconPath-six. Connector access and organization profile publication remain unverified; see the prepared profile and access guide. A dedicated Hugging Face organization is not verified.

## Local development
Requires Node.js 20 or later. The site has no runtime dependencies; dev dependencies (Prettier, Playwright, axe-core) are for formatting and tests only.

```bash
npm ci                                 # install dev tooling
npm run dev                            # http://localhost:5173 with production headers
npm run format:check                   # formatting
npm run check                          # catalog schema + script syntax
npm test                               # Node VM content/logic checks
npm run build                          # produce dist/
npx playwright install chromium        # once, for browser tests
npm run test:e2e                       # Chromium route, accessibility and overflow checks
npm run test:rtl                       # RTL engine vs Icarus Verilog + Yosys (tools must be installed)
```

See [architecture](docs/ARCHITECTURE.md), [changelog](CHANGELOG.md), [security policy](SECURITY.md) and [code of conduct](CODE_OF_CONDUCT.md).

The build produces `dist/`. The development server uses http://localhost:5173. Hash routes support static hosting. See the operational notes below for deployment and catalog maintenance.

## Participate
Report a reproducible bug, propose a source correction, improve accessibility, document a simulation or help review a scoped learning activity. Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting.

## Public identity and contact
- Website: https://siliconpath-six.vercel.app/
- Canonical source: https://github.com/Arungharami/SiliconPath
- Maintainer: Arun Kumar Gharami
- Contact: [arun_gharami@live.com](mailto:arun_gharami@live.com)
- Proposed organization setup: [prepared plan and profile copy](docs/ORGANIZATION_SETUP.md)

Independent educational project · Prepared for faculty discussion.
No institutional affiliation, endorsement, accreditation or certification is implied.

Third-party resources retain their owners' rights. Do not infer a reuse license from public repository visibility; a project-wide license has not been selected.


## Maintenance and validation
Edit `resources.json` for catalog changes. Run `npm run check`, `npm test`, `npm run build` and `npm run test:e2e`. New script files must be added to `scripts/files.mjs` and `index.html`. Use `npm run catalog -- list fabrication` to inspect records and `npm run export:catalog` to export the catalog. The development server is http://localhost:5173.

Vercel uses build command `npm run build`, output directory `dist` and the existing SiliconPath project. Notes and progress use browser localStorage. No account system or cloud synchronization is implemented.

See [roadmap](docs/ROADMAP.md), [editorial guide](docs/EDITORIAL_GUIDE.md) and [resource catalog](docs/RESOURCE_CATALOG.md).

