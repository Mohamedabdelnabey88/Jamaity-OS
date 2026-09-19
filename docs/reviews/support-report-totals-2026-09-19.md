# Support report totals and post-deployment browser verification

Baseline: `79437fd4edb8e03b97e318d80cbbd4223e35f9d4` (PR25).

## Reproduced defect and repair

The authenticated production support report showed a cash support row but a zero monetary total. `operational_report_page` summed only the legacy `financial` type; the current support form creates `cash` records.

`report_support_cash_totals.sql` includes both cash and financial support in monetary totals. Donation totals still include cash only. In-kind valuations remain excluded. The migration changes neither stored records nor existing permission, tenant, date, search or pagination checks.

Applied to the authorized Supabase project as `include_cash_support_in_report_totals`. The expanded regression failed with `wrong_support_totals` before application and passed afterward. It combines financial 75, cash 125 and in-kind valuation 900, expects a total of 200, and checks that a one-row page still reports the full matching total. The suite also verifies donation totals, date boundaries, literal search, access restrictions and private-field exclusion. All fixtures, including the platform administrator, are synthetic and rolled back.

## Production browser observations

- Authenticated monthly report loads after PR25's CSP deployment, with financial and operational tables.
- Donation details load; selecting the rejected-status filter produces zero matching rows and a zero total.
- Support details load. After the migration and refresh, the monetary total matches the existing cash support row.
- No site-origin console errors or CSP violations appeared in the captured error/warning log; browser-extension metadata errors were excluded.
- Excel click returned to its idle state without a visible export error, but the browser download event timed out. Download completion and file contents remain unverified. Browser policy blocks access to its internal download-history page; no workaround was attempted. Absence of an error is not a passed download test.

No real charity records were added, edited or removed during these checks. No invitation emails were sent.

## Security and remaining work

The post-migration advisor retains the previous categories: 6 RLS-without-policy INFO, 3 anonymous and 108 authenticated definer warnings, and disabled leaked-password protection. No broader permissions were introduced. This is not a complete security certification. The performance, role-by-role browser, binary-upload, recovery-email and backup-restore gaps in the full-journey review remain open.
