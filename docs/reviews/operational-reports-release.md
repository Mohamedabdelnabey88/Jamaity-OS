# Donation and support detail reports — 2026-09-18

Baseline: f4af072fb2316f53063a1a4321cee6022a6b1417 (dependency hardening).

## Delivered

- Add operational_report_page for donation/support detail with Saudi period boundaries, status and literal reference/ID search, deterministic 50-row UI pagination (API max 100).
- Tenant comes exclusively from private.current_charity_id. Require reports.view plus donations.manage or support.manage/support.approve. No caller-supplied tenant and no personal names, beneficiary IDs, phone numbers, identity numbers or free-text notes in the output.
- Totals cover all matching pages, with monetary totals limited to cash donations/financial support. They do not imply receipt or disbursement; status remains visible.
- Support period is based on record creation; execution date is a separate column.
- Integrate both reports into Reports with the same displayed snapshot feeding Arabic RTL Excel and print/save PDF. Exports explicitly contain the displayed page only, while the summary totals cover all matches. Quantities retain up to three decimals.
- Bound report reads, cancel on refresh/unmount and ignore stale results. Existing summary report is preserved.

## Validation

- Applied add_scoped_operational_report_pages to yagbmbuevtjaqypkujaf only after rollback dry-run.
- Post-application BEGIN/ROLLBACK smoke passed: 54 fixtures split 50/4 without overlap, total 530 cash excluding in-kind valuation, neighboring Saudi days excluded, literal percent/underscore search, status filters, support total, separate tenant isolation, reports-only rejection, module-only rejection, combined-role success, platform/anon denial, private-field exclusion.
- All 29 Node tests passed, including workbook round trips, per-page export labeling, server totals and quantity precision. TypeScript/Vite build passed (existing large lazy ExcelJS chunk warning).
- Security Advisor: six RLS/no-policy INFO entries, three anon-definer WARN entries, 106 authenticated-definer WARN entries, leaked-password protection WARN. The new RPC intentionally uses the project's scoped definer pattern; anon denied, empty search_path, auth/tenant/module permissions tested. No existing grants were broadened to silence warnings.
- Advisor documentation: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Remaining limits

Authenticated browser verification of report selection, filters, next-page navigation, download and print remains pending sign-in. Tests above are not full browser E2E. Inventory/governance/beneficiary detail, historical stock, full-result exports, direct PDF generation, import previews and donation-to-impact linkage remain follow-up. Real charity data were not changed and no messages sent.
