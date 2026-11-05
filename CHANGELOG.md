# Changelog

Entries before 1.5.0 are summarized from commit history.

## 1.5.0 — Unreleased
### Fixed
- `npm run dev` returned 404 for every file (path-guard bug and incomplete allowlist).
- Project detail pages scrolled horizontally at 375px width.
- Text colour contrast below WCAG AA (4.5:1) on 11 routes.

### Added
- Security headers: Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Browser test suite (`npm run test:e2e`): all routes at desktop and phone width with console, overflow and axe accessibility checks; runs in CI.
- Single shipped-file manifest (`scripts/files.mjs`) shared by build, dev server and checks.
- Prettier formatting with a CI check; source reflowed for reviewable diffs (no behavior change).
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/ARCHITECTURE.md`, this changelog.

### Removed
- `scripts/seed.py`, a stale generator that would have overwritten the 32-entry catalog with 22 entries. It remains in git history.

## 1.4.0 — October 2026
- Digital circuit lab, engineering project catalog and code library.
- Course concept and two-lab development proposal pages.
- Packaging and PCB learning pilot.
