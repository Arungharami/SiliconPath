# SiliconPath
**Semiconductor education, training-lab planning & volunteer project support**

[Visit SiliconPath](https://siliconpath-six.vercel.app/) · [About & mission](https://siliconpath-six.vercel.app/#about) · [Services](https://siliconpath-six.vercel.app/#support) · [Project charter](docs/PROJECT_CHARTER.md) · [Contribute](CONTRIBUTING.md)

Created and curated by [Arun Kumar Gharami](https://www.arungharami.info/).

## Mission
Connect credible semiconductor learning with practical planning, digital tools and voluntary project support so learners and project teams can make informed decisions.

## Vision
A pathway from curiosity to capability: more learners and institutions developing semiconductor knowledge, supervised practical skills and well-documented projects.

## What you can use today
- Six guided learning paths and a curated catalog of 32 starting resources.
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

- Functional/content checks and the static build passed during the October 11, 2026 update.
- Tests run in a Node VM; full browser and visual verification remains outstanding.
- Source descriptions summarize listings; full-content and faculty review are pending.
- Detailed Vivo-related warehouse and volunteer project case studies require exact roles, dates, permitted names and supporting evidence.
- A dedicated GitHub organization and Hugging Face organization are proposed, not yet created or verified.

## Local development
Requires Node.js 20 or later. No runtime npm dependencies.

```bash
npm run check
npm test
npm run build
npm run dev
```

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

---
## Technical history and operational notes

# SiliconPath

**From semiconductor knowledge to capability.** A public study library and training-center planning platform created and curated by **Arun Kumar Gharami**.

Created and curated by [Arun Kumar Gharami ↗](https://www.arungharami.info/)

Independent educational project · Prepared for faculty discussion,
No institutional affiliation, endorsement, accreditation or certification is implied.

## Version 1.3 — Operational studies

- Model-specific inputs, actions, outputs and capability boundaries.
- Projected 3D teaching-route arrows and deep links to a specific lab/station.
- Editable phase-by-phase setup timeline with optional start/finish date. Durations are illustrative sequential planning assumptions, not verified lead times.
- Separate user-entered cost scenarios for each scale, transferable to the planner.
- Sixteen blank document templates and complete downloadable model studies.
- Launch and restart review guidance; no equipment operating recipes.
- 32 starting resources.

## Version 1.2 — Decision guides

- Start Here journeys for learners, faculty and lab planners.
- Nine equipment categories with skills, tasks, selection criteria, dependencies and original source links.
- Six draft curriculum modules with student outputs and rubric dimensions; selected module export.
- Quote-based USD worksheet with one-time, annual and first-year subtotals; included in lab brief and workspace backup. Blank costs stay unspecified.
- 29 starting resources and direct book/video/course/paper/report shortcuts.
- Grouped navigation that keeps planning tools together.

## Version 1.1 — Lab Studio

- Interactive 3D micro, medium and large lab concepts, rendered from three-dimensional geometry without external libraries.
- Orbit, zoom, top view, equipment selection, labels and a paced animated tour.
- Twelve educational workflow topics with inputs, outputs, activities, dependencies and linked sources.
- Lab-to-planner transfer and exported lab study guides.
- Credits: Created and curated by Arun Kumar Gharami. Independent educational project.
- Conceptual animation only: no live hardware, fabricated device data, engineering dimensions or operating recipes.

## First release

- Six learning paths: foundations, fabrication, devices and testing, chip design, packaging and research, and workforce planning.
- 29 starting resources across books, courses, videos, guides, papers, reports and collections.
- Search and combined format/topic/level filters, detail guides and saved reading lists.
- Study activities, knowledge checks, self-reported progress and exportable study guides.
- Training-center planner with digital classroom, measurement/testing and fabrication models; ten-step checklist and exportable faculty brief.
- Local study notebook, workspace JSON backup/restore and responsive accessible navigation.

Source listings were checked on October 8, 2026. Resource descriptions are selection notes, **not full-text reviews**; full-content and faculty review are pending. Older academic resources are identified. Access and current enrollment conditions must be checked with the provider. Workshop reports are not presented as experimental papers.

## CLI and local use

Requires Node.js 20+. No runtime or npm dependencies.

```bash
npm run check
npm test
npm run build
npm run dev
npm run catalog -- list fabrication
npm run export:catalog
```

The dev command serves http://localhost:5173. The build produces `dist/`. Hash routes allow static hosting without custom rewrite configuration.

Edit `resources.json` to maintain the catalog; update the review state only after the corresponding review occurs. `scripts/seed.py` records the initial dataset and should not be used to overwrite later editorial work.

## Deploy on Vercel

Import `Arungharami/SiliconPath` into the intended Vercel account/team. Framework: Other; build command: `npm run build`; output directory: `dist`; no environment variables required. These settings are also in `vercel.json`.

For a local CLI deployment, install the official Vercel CLI and authenticate in your own terminal. Link explicitly to the intended project/team, then verify the target before deployment:

```bash
vercel link --project siliconpath --scope aruns-projects-ba93fc58
vercel project inspect --non-interactive
vercel --prod --scope aruns-projects-ba93fc58
```

Do not assume a domain until Vercel returns a successful deployment URL. The existing production project is `siliconpath`, with public address https://siliconpath-six.vercel.app/. Verify deployment state and commit when releasing changes.

## Validation

`npm run check` validates catalog structure and JavaScript syntax. `npm test` runs functional/content checks in a Node VM for routes, references, filters, escaping and exports. It is **not** browser verification. Representative projected 3D scenes were also rendered to images for geometry review; full-page browser QA remains outstanding. CI runs validation and build. No remote link availability guarantee is made.

## Data and authorship

Personal notes, reading lists and progress use browser localStorage. There is no server, account system or cloud sync. Export for a portable copy. Restore replaces the current local workspace after confirmation. External content stays with its owner; this project links to authorized source pages and does not redistribute paid publications.

See [development roadmap](docs/ROADMAP.md), [editorial guide](docs/EDITORIAL_GUIDE.md) and [resource catalog](docs/RESOURCE_CATALOG.md).

## Project contact

For project consulting, contract discussions or voluntary collaboration: [arun_gharami@live.com](mailto:arun_gharami@live.com). Participation and terms require individual agreement.
