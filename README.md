# SiliconPath

**From semiconductor knowledge to capability.** A public study library and training-center planning platform created and curated by **Arun Kumar Gharami**.

Prepared for faculty discussion, including Professor María Mercedes Larrondo-Petrie, and designed for learners and educators worldwide. Independent project; no institutional affiliation, endorsement, accreditation, funding access or recognized certification is implied.

## First release

- Six learning paths: foundations, fabrication, devices and testing, chip design, packaging and research, and workforce planning.
- 22 starting resources across books, courses, videos, guides, papers, reports and collections.
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

Do not assume a domain until Vercel returns a successful deployment URL. This session's Vercel connection denied project creation; the site was not deployed by that connection.

## Validation

`npm run check` validates catalog structure and JavaScript syntax. `npm test` runs functional/content checks in a Node VM for routes, references, filters, escaping and exports. It is **not** browser or visual verification. CI runs validation and build. No remote link availability guarantee is made.

## Data and authorship

Personal notes, reading lists and progress use browser localStorage. There is no server, account system or cloud sync. Export for a portable copy. Restore replaces the current local workspace after confirmation. External content stays with its owner; this project links to authorized source pages and does not redistribute paid publications.

See [development roadmap](docs/ROADMAP.md), [editorial guide](docs/EDITORIAL_GUIDE.md) and [resource catalog](docs/RESOURCE_CATALOG.md).
