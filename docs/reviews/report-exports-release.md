# Scoped reports and Arabic exports — 2026-09-17

Baseline: e97a9185cfef75c28732f6d02b79c9a180fab367.

## Changes

- Fix Saudi civil-day boundaries in income statement and trial movement RPCs. A September 2 Saudi-day fixture previously included September 1 and returned expense 275 rather than 75.
- Make monthly reports usable with reports.view alone. Dashboard, governance, inventory and activity metrics require their respective module permissions; unavailable data is null, never an invented zero. Reject invalid reporting periods.
- Add six Arabic RTL Excel worksheets generated from the same snapshot as the screen, preserving numeric cells and leading-zero account codes; untrusted text is exported as text, never formulas.
- Add print/save-as-PDF layout through the browser's print dialog. This is not a server-generated PDF download.
- Clearly distinguish period movements from current operational/governance/inventory snapshots. Exports use the applied period, not unsubmitted date edits.

## Validation

- Database migration repair_report_scope_and_saudi_dates applied only to yagbmbuevtjaqypkujaf.
- SQL smoke passed after application, with BEGIN/ROLLBACK: adjacent-day exclusion, income/trial agreement, reports-only role, unavailable module data, invalid/null dates, revoked permission, platform-only user, anon rejection.
- 21 Node tests passed, including XLSX serialization/reload: RTL, zero/decimal values, missing values, hidden sections, account codes and formula-like strings.
- TypeScript and Vite production build passed. ExcelJS is loaded on export; Vite reports a large lazy ExcelJS chunk.
- Public production homepage opened successfully. Current browser session is signed out; authenticated export click and print preview are not verified in this batch. Prior-session browser results do not substitute for these checks.

## Limits and follow-up

- These are summary reports and trial movements, not complete detailed beneficiary/support/donation ledgers or a full historical inventory report.
- Detailed reports, import/error preview, direct PDF generation, all-role browser mutation coverage and campaign-to-impact linkage remain outstanding.
- npm audit --omit=dev reports two high and two moderate package findings: existing react-router/react-router-dom and ExcelJS's transitive uuid. ExcelJS uses uuid.v4; the reported uuid advisory concerns v3/v5/v6 buffer arguments, which this export path does not call. No claim of a clean security audit. Dependency remediation and routing regression checks remain a separate task.
- No real charity records changed and no email sent for these tests.
