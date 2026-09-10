# Accounting reliability and working finance forms

Source baseline: main 4c0cdcb04ae1a8a3690f47af24d119e1e6dc96ce. Database: yagbmbuevtjaqypkujaf only.

## Repairs applied
- Voucher creation allocates its UUID before posting and writes the journal reference in the initial insert. Posted-entry immutability remains intact.
- Voiding reads accounting_reverse_journal.reversal_id, preserving the linked reversal. Repeated voiding stays idempotent.
- Budget actuals ignore journal lines whose posted entry is outside the budget period. A 75 current-period / 200 next-period fixture returns actual 75 and variance 925 against budget 1000.
- No pre-existing void vouchers without reversal links were found.

## Frontend
- Multiline journal entry form with date, active account, debit/credit, notes, optional cost center/fund, integer-cent totals, open-period validation and a stable request reference for retries.
- Budget creation as draft, approval, and per-line budget/actual comparison. Overlapping dimension scopes are not summed into a misleading grand total.
- Account creation and name/status maintenance via a tenant/permission-scoped RPC. Codes and classifications remain immutable after creation.
- Finance loads only the sources required by the active route; catches errors, offers retry, ignores stale results and checks access strictly.
- Mutating actions respect accounting.manage in the UI; RPCs remain the authorization boundary.
- Voucher mutation errors appear inside the form, with busy protection and Arabic error mapping.

## Verification
- TypeScript + Vite production build passed.
- Existing 15 Node tests passed.
- Transaction/rollback SQL regression: registration/trial/approval/expiry/extension; balanced/unbalanced/reversed journals; all four vouchers create/void/repeat-void/reference links; budget period boundaries; donor/cash donation; in-kind inventory; report RPC execution; period closing. All passed.
- Voucher creation was also exercised with SET LOCAL ROLE authenticated.
- Account editor transaction/rollback: authenticated create/update, stable identity, foreign-account denial, platform-without-tenant denial, anonymous execute denial. Passed before and after applying the migration.
- Security/Performance Advisors reviewed. Intentional RPC-only tables and definer notices retained. Leaked-password protection remains outstanding.

## Verification limits and next work
- Browser could not open local UI fixture URL (ERR_BLOCKED_BY_CLIENT); fixture files were removed. No claim of visual or full browser E2E verification.
- Vercel connector returns 404 for the existing project/deployment. GitHub's Vercel status is the available build signal; it does not prove that the shared alias is public.
- Public alias protection, leaked-password setting, PDF/Excel reports, bank reconciliation, campaign-to-ledger impact linking, budget revisions and journal server pagination remain separate work. Journal listing explicitly identifies its latest-200 scope.
- SQL fixtures simulate Auth identities; they do not test email delivery or password recovery.
