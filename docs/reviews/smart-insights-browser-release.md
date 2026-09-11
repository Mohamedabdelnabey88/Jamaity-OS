# Browser follow-up and smart insights repair — 2026-09-11

Baseline: PR17 merged as 8dbb7074356d9e9968d71857bf37682387b876f3.
Vercel production dpl_4iZs2gWkmP2PfXnF5Sd65zsnouSk was READY and matched this SHA. Public browser verified the demo label and removal of the unsupported percentage at https://jamaity-os.vercel.app/.

## Authenticated verification

The user completed sign-in through secure browser handoff. The authenticated charity was not assumed disposable: no real journals, vouchers, budgets, periods or charity records were created/changed.

Observed successful loading of accounting overview, accounts, journal list, financial periods, budgets, vouchers and reports. Opened account, journal, budget and voucher forms without submitting them. Journal search returned zero for a synthetic unmatched term, then restored the original result count when cleared. This verifies the deployed PostgREST search path, not only SQL or a local mock.

No claim of completed posting/browser E2E or verification of every role. SQL rollback fixtures cover writes and permission boundaries separately.

## Discovered defect and repair

Dashboard insights failed with PostgreSQL 42702: amount was ambiguous between a PL/pgSQL variable and the donations column. Reproduced with a rollback fixture. Qualified the column and renamed the aggregate variable.

The SECURITY DEFINER insight function previously checked tenant access without checking each module permission. Added checks for beneficiary, donor, donation, accounting and inventory insights; no module is queried for unauthorized insight content. PUBLIC/anon execution revoked; authenticated execution retained. Auth, tenant and subscription checks remain.

Applied only to yagbmbuevtjaqypkujaf: repair_smart_insights_amount_and_module_authorization. Transactional dry-run and post-application smoke passed for five pages, a no-permission role, platform-admin isolation and anonymous denial. All fixtures rolled back.

Security Advisor unchanged: 6 RLS-no-policy INFO; 3 anon definer, 105 authenticated definer, 1 leaked-password-protection WARN. Existing RPC-only tables were not opened to silence warnings.

Remaining: authenticated write tests on an explicitly disposable charity, beneficiary document uploads and all-role E2E, exports/imports, reports-only-role audit, and donation-to-impact linkage.
