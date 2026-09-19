# Production journey and security review — 19 September 2026

Baseline main: 1e0b72e8bb2af8c1be999843ca8f3e936bba703f. Scope is functional verification and targeted security review, not a penetration-test certification or guarantee against compromise.

## Defects reproduced and repaired

1. Production monthly reports failed with `cannot execute INSERT in a read-only transaction`. The STABLE report called governance_center, which initializes requirements with INSERT. Ordinary SQL smoke tests did not model PostgREST's read-only execution. The report now aggregates existing governance records without writes. An empty/uninitialized governance set returns a null score. The error was reproduced with BEGIN READ ONLY, then the same authenticated read-only query and the production browser succeeded after applying remove_governance_writes_from_monthly_report.
2. The public directory exposed approved charities with future-starting or missing subscriptions. A synthetic anon-role regression failed before repair. align_public_directory_with_subscription_access now requires a started, unexpired active/trial subscription, matching workspace eligibility. The regression passed after application.
3. Added production response headers: CSP, anti-framing, nosniff, no-referrer and disabled unused camera/microphone/geolocation. CSP permits the existing Google fonts, HTTPS images, own scripts and the allowed Supabase endpoint. Post-deploy browser checks are required to catch CSP compatibility problems.
4. Removed redundant dynamic import of reportExport, already statically used by Reports. ExcelJS remains separately lazy-loaded; this change does not claim a large speed gain.

## Current verification

All database tests use synthetic fixtures with BEGIN/ROLLBACK; no invitations/emails or real charity mutations were used. Existing test files that selected an arbitrary platform administrator were executed with a synthetic platform-only administrator instead, to avoid depending on real administrator memberships.

Passed suites:
- Accounting integrity: 15 scenarios covering registration/trial, approval timing, expiry/extension, balanced/unbalanced journals, reversal, four voucher types and repeated void, budget period boundaries, cash/in-kind receipts, stock, report execution and closed periods.
- Accounting read permissions: 201 journal rows, final page/search, read/write permissions, tenant isolation and expired/platform access denial.
- Report period/permission suite and detail report paging/filter/private-field suite.
- Beneficiary evidence visibility/manual inactive creation and tenant/reader/platform/anon isolation.
- Staff invitation create/accept/revoke, email/code mismatch, reuse, duplicate/member checks and shared/custom role isolation.
- New beneficiary support journey: missing evidence blocks approval; approval links account; beneficiary requests support; another charity cannot review it; approved support executes; request becomes fulfilled; exactly one financial journal exists; beneficiary summary shows the provided amount.
- New public directory subscription regression.
- Production authenticated read-only monthly report after fix.
- TypeScript/Vite production build and all 29 existing Node tests.

Authenticated browser observations:
- Existing member invitation rejects with an actionable Arabic message. Self-permission buttons are disabled.
- Accounting overview, accounts, journal list and composer, budgets, fiscal periods, receipt voucher list load. No production financial records posted during browser checks.
- Reports initially failed, then showed financial rows successfully after the database fix.
- Inventory shows its empty state. Approval inbox shows its empty state.
- Prior authenticated follow-up verified seven beneficiary document actions and signed-link generation. A complete binary upload/download flow remains unverified.
- Rapid navigation snapshots were discarded when they showed the previous page or a loading state; those are not counted as successful screen tests.

## Security findings and limits

- Zero public tables without RLS. Reviewed team/membership/role policies allow scoped reads and keep writes in checked RPCs.
- All inspected SECURITY DEFINER search paths were explicitly empty. The provider-secret RPC denies anon and authenticated execution; its value was not retrieved.
- Beneficiary documents and governance evidence buckets are private; public charity media is intentionally public with image-type/size limits.
- The three anonymous definer RPCs are public directory/site/post reads. Published-content and subscription conditions were reviewed; directory eligibility was repaired above.
- Advisor remains: 6 RLS-without-policy INFO (RPC-only tables), 3 anon and 108 authenticated definer warnings. This is not a complete manual review of every callable function. Performance advisor: 45 unused-index INFO, no indexes removed.
- Leaked-password protection remains disabled; no callable Auth configuration tool was available. Review in Supabase Dashboard without an automatic paid-plan upgrade: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- npm audit --omit=dev reported zero known findings in installed production dependencies. ExcelJS's prebuilt browser bundle is not rewritten by the package override; this is not evidence that every bundled component or application logic is vulnerability-free.

## Performance and unfinished acceptance

Initial shell HTTP probe returned 200 with TTFB 10.243s from this environment. It is a network-path observation, not a real-user Core Web Vitals benchmark or server processing measurement. Build: main JS ~405.6 kB / 122.4 kB gzip; lazy ExcelJS ~940.1 kB / 271.3 kB gzip. Large optional export chunk warning remains.

Still unverified: authenticated browser journeys for each restricted role and platform administrator, new-user email verification/recovery delivery, full binary uploads, complete field/distribution evidence, mobile visual/layout coverage, load/concurrency, backup restore, independent penetration testing, and production real-user performance. These remain acceptance gaps; no claim of launch readiness or complete protection is made.
