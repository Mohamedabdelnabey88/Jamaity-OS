# Dependency hardening — 2026-09-18

Baseline: ed3fab0a967c7a55a39cea9ecaea26e7b11dd01c.

- Upgrade react-router-dom/react-router from 7.8.2 to 7.18.4, staying on the existing major version.
- Override ExcelJS's installed uuid dependency to patched CommonJS-compatible 11.1.1. Regenerate and commit the npm lockfile.
- CI uses npm ci to test the exact committed dependency graph.
- npm audit --omit=dev reports 0 findings in the installed production dependency graph. This is not a full application security audit, nor a scan of vendored browser bundles.
- ExcelJS's prebuilt browser distribution still contains its own bundled dependencies; npm overrides do not rewrite it. ExcelJS uses UUID v4, while GHSA-w5hq-g745-h8pq concerns v3/v5/v6 buffer handling. Do not claim that every vendored dependency was upgraded. Replacing/rebuilding the browser distribution remains follow-up.

Validation: original 25 tests passed, plus 3 compatibility tests for router locations/links, source XLSX conditional formatting (the uuid v4 path), and the distributed browser XLSX serializer. TypeScript/Vite build passed; the lazy ExcelJS chunk retains its existing size warning. Browser-library tests run in Node, not an authenticated browser journey. No DB or real-user data changes.

Sources: https://github.com/remix-run/react-router/blob/v7/CHANGELOG.md#v7184 and https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq.
