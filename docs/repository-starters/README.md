# SiliconPath repository starters

Status: initial draft, 2026-10-14. Organization publication is pending verified access.

Start with two repositories: `.github` for the organization profile and `semiconductor-learning` for usable educational resources. Keep the website in Arungharami/SiliconPath until its deployment connection is deliberately reviewed.

## Publication map

| Target repository | Source in this repository | Destination |
| --- | --- | --- |
| SiliconPath-six/.github | docs/GITHUB_ORGANIZATION_PROFILE.md | profile/README.md |
| SiliconPath-six/semiconductor-learning | semiconductor-learning/README.md in this folder | README.md |
| SiliconPath-six/semiconductor-learning | semiconductor-learning/STARTER_PATH.md | STARTER_PATH.md |
| SiliconPath-six/semiconductor-learning | semiconductor-learning/ACTIVITY_WORKSHEET.md | ACTIVITY_WORKSHEET.md |

The organization profile destination is `profile/README.md` relative to the root of the repository named `.github`. Do not add another `.github` directory.

## Owner checklist

1. Verify the signed-in account and organization access. A 404 alone does not establish that a repository is absent.
2. Confirm whether each repository already exists. Inspect its files before copying or integrating content.
3. If absent, create a public repository using the GitHub New repository page with SiliconPath-six selected as owner. Initialize its README to establish the default branch.
4. Add the mapped content on a feature branch and open a pull request. Review links, content, and attribution before merging.
5. Confirm the profile appears on the organization Overview page and the learning documents open correctly.
6. Pin semiconductor-learning and link it from the website once published.
7. Select a license for original material before inviting reuse; public visibility alone is not a reuse license.

These are prepared files, not evidence that the organization repositories have been created. The existing organization profile copy is reused rather than duplicated. The generated logo has not been uploaded by this change.

## Next milestones

- Subject reviewer checks the starter guide and records corrections.
- One learner completes the worksheet and reports unclear instructions.
- After publication, add a verified repository link to the website.
- Expand lab planning and demonstrations only when each has a usable artifact and maintainer capacity.
