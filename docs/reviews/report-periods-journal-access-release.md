# Report periods and accounting reader access — 2026-09-10

Baseline: main ad97098cc38834581ed6e3aa3601f6009c6f10c4 (PR16), clean checkout.

## Verified environment

- Supabase: yagbmbuevtjaqypkujaf, ACTIVE_HEALTHY, ap-northeast-2. No other database touched.
- Vercel discovery identifies jamaity-os as prj_XSer6OHFY3XIMGsXnnDMOB4axEIY, linked to Mohamedabdelnabey88/Jamaity-OS.
- Production deployment dpl_DBvMF8bWyDXwaDkqfD1XE3uCJw3i matched the baseline SHA and was READY.
- https://jamaity-os.vercel.app/ rendered the application in the browser without Vercel authentication.
- The previously shared team alias still redirected to Vercel login. No protection settings were changed, and no temporary share link was substituted.

## Changes

- Accounting SELECT policies now recognize accounting.view/accounting.manage in addition to existing readers. Tenant, active membership, and subscription boundaries remain enforced. No new table grants or write permissions.
- Journal list requests 50 entries per page with an exact count, deterministic ordering, and server-side description/reference-type search. It no longer truncates the searchable dataset at 200. Search values are quoted; percent/underscore are escaped. PostgREST's asterisk wildcard syntax remains available.
- Reports distinguish dated financial/activity figures from current operational, governance and inventory snapshots. Applied dates remain visible when draft filters change; invalid dates, failed requests and stale responses cannot leave a misleading old report on screen.
- Reporting boundaries use inclusive Saudi calendar days, including sub-second values at the end of the last day.
- Added period trial movement and current inventory balance tables. The inventory contract uses on_hand.
- Removed the unsubstantiated +12% marketing badge and marked the dashboard illustration as a demo.

## Validation

- Regression reproduced before the policy change: accounting.view-only fixture saw 0 of its 201 journal entries.
- Transactional policy dry-run passed. Applied migration: align_accounting_read_policies_with_explicit_permissions. Re-ran the smoke test after application; passed and rolled back fixtures.
- Tests cover 201 entries, page after offset 200, description matching, line visibility, accounting.view/manage, write denial for reader, cross-tenant denial, no-permission denial, expired subscription denial, and platform admin denial.
- Re-ran accounting_integrity_smoke.sql: 15 checks passed, including four voucher types, reversal, budget date boundary, donations, stock movement, trial lifecycle and period lock. Fixture data rolled back.
- 19 Node tests passed; TypeScript and Vite production build passed.
- Security Advisor: 6 RLS-no-policy INFO, 3 anon definer WARN, 105 authenticated definer WARN, leaked-password protection WARN. Performance: 46 unused-index INFO. No policies were added to RPC-only private-data tables to silence warnings.

## Limits and remaining work

- Browser verified public landing, login selector, and charity login form. No authenticated session was available for browser tests of accounting or beneficiary journeys. SQL tests are not browser E2E.
- Database tests exercise query semantics; the paginated UI and PostgREST filter parsing still require authenticated browser/API verification.
- Existing monthly report RPC has dependencies on other module permissions; a reports-only custom role remains to be reviewed. Governance fallback behavior is unchanged.
- PDF/Excel exports, imports, comprehensive module detail reports, campaign-to-donation-to-delivery linkage, and later differentiation features are not delivered in this batch.
- Actual file uploads, recovery email delivery, load testing and backup restoration remain unverified.
- No AI secret was retrieved; no real invitation or email was sent.
