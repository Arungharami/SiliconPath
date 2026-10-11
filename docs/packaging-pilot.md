# Packaging & PCB Learning Pilot

Open `#packaging` in SiliconPath. Five lessons cover die/package/PCB roles, wire bonding and flip-chip, chiplets and interposers, PCB layers and vias, and inspection versus electrical testing.

Each lesson includes a projected 3D concept model, keyboard-operable rotation and layer separation, component descriptions, a learning objective, an activity, a knowledge check and primary-source reading. Comparison controls are available where relevant. Notes are stored locally per lesson when browser storage is available; Markdown exports preserve the objective, activity, notes, sources and evidence limitations. No notes are submitted to a server.

## Boundaries

Models are not to scale and omit detailed routing, materials, manufacturing parameters and many connection structures. The stacked chiplet view is conceptual. The inspection/test view demonstrates different evidence questions; it does not simulate measurements, defect detection or acceptance testing. Activities are self-directed and do not confer certification or validate factory capability.

## Facilitation

1. Ask learners to identify components before reading the explanation.
2. Rotate and separate the model; compare alternative views when available.
3. Read a linked primary source and identify one model simplification.
4. Complete the activity and explain the knowledge-check answer.
5. Download notes for discussion. Decide separately how to collect consent and review learning evidence.

No participant outcomes or institutional adoption are claimed. Evaluate clarity, accessibility and learning evidence before expanding this pilot.

## Maintenance and verification

Lesson content, sources, geometry and bindings live in `packaging.js`; styles are in `styles.css`. The build copies the module to `dist/`. Run `npm run check`, `npm test` and `npm run build`. Tests cover routes, finite geometry across both modes and control limits, interconnect comparisons, resets, note persistence, exports and answer feedback. VM tests do not replace browser or visual review.
