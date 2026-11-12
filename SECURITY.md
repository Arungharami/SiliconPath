# Security policy

## Scope
SiliconPath is a static website with no server-side code, accounts or database. Learner data is stored only in the visitor's browser (`localStorage`). Relevant reports include cross-site scripting, content injection through catalog or stored data, unsafe links, header or Content-Security-Policy weaknesses, and vulnerable development dependencies.

## Reporting a vulnerability
Email arun_gharami@live.com with the subject "SiliconPath security". Include the affected URL or file, reproduction steps and the impact you observed. Please do not open a public issue for an unfixed vulnerability.

This is a volunteer-maintained project: there is no bug bounty and no guaranteed response time. Reports are acknowledged when reviewed, and fixes are credited in the changelog if you wish.

## Supported version
Only the current `main` branch and its production deployment are maintained.
