# Account and application review — 2026-09-07

Base: main 4cc746b570518fe04c3b1bbadd565fd92cffbbfd. Database: yagbmbuevtjaqypkujaf only.

## Changes

- Replace cryptic logout avatar with a labelled, accessible logout control. Local-session signout checks errors before redirecting; full navigation discards in-memory tenant data. Other devices remain signed in.
- Add /account inside the existing authenticated, enabled-workspace boundary. Charity logo and account button open this profile, with subscription dates, public site link and permission-gated settings/team links.
- Reflow workspace header so account and logout controls remain visible on narrow screens. Close mobile navigation after selecting a page.
- Align Settings route permission with live update_charity_profile RPC: onboarding.manage.
- Prevent failed smart-insight requests from reporting an all-clear state.
- Donor contribution totals now include received donations only.

## Verification performed

- Remote main checked before edits; local main.tsx matched the remote file.
- TypeScript project compilation and Vite production build passed.
- Static inventory of frontend RPC calls: all 82 literal RPC names exist in the live public schema. This verifies names, not all signatures or behaviors.
- Live charity_profile and update_charity_profile definitions inspected: authenticated session and tenant resolution required; mutations require onboarding.manage; explicit empty search_path.
- anon cannot execute charity_profile; authenticated can. A rollback test with an unrelated synthetic auth UID received forbidden from charity_profile. No test data retained.
- Public ordinary tables without RLS: 0.
- Security Advisor: 4 RLS/no-policy informational entries, 2 anon and 97 authenticated SECURITY DEFINER exposure warnings, 1 leaked-password-protection warning. These are not a clean security certification; every privileged RPC needs individual review.
- Performance Advisor: 48 unused-index informational entries. No indexes removed without workload evidence.

## Remaining work and priorities

1. Enable leaked-password protection and verify recovery email delivery, session expiry and MFA for privileged accounts. Current warning remains open.
2. Add end-to-end browser regression coverage for owner/employee/beneficiary/platform roles, signout failures, narrow screens, uploads and aid posting. This release has not been authenticated-browser verified.
3. Auth/access hooks lack consistent timeout/error states; getAccessState currently masks RPC errors as blocked access. Introduce an explicit unavailable state and session/access refresh on focus and subscription expiry throughout the workspace.
4. Replace manual route branching with explicit route definitions and a not-found screen. Some unknown workspace subpaths currently fall through to Notifications.
5. Standardize data loading, error handling, pagination and cancellation. Multiple list pages cap at 200 rows and perform local search only.
6. Split route bundles: Vite reports a main JS chunk above 500 kB. Avoid loading all operational modules on landing/login.
7. Continue financial reconciliation tests, receipt/payment voucher review and print/export verification; do not present compile success as accounting certification.
8. Keep computed operational recommendations clearly explained. No external generative AI model integration was introduced in this release.

## Scope limit

This is a targeted code review plus repository-wide RPC inventory and database advisor checks, not an exhaustive line-by-line audit, penetration test, or confirmation that every page is defect-free. Production readiness still requires the browser and lifecycle tests above.
