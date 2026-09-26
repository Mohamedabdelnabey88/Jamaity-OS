# Stock issue integrity

Baseline: `0b9a86cecda4742d246ac2e6521d145e882df2c9` (PR28).

## Repair

An exact retry of a completed in-kind issue failed with `support_not_approved`: the approval check preceded the existing movement check. Distinct support records also lacked a shared stock-item lock before reading available quantity.

- Return the original movement and journal for an exact retry, without another execution event. Reject changed warehouse, item or quantity and inconsistent existing execution state.
- Lock the tenant's inventory item before reading its stock balance. This conservatively serializes issues across warehouses for the same item. Receipt foreign-key checks remain compatible with the NO KEY UPDATE lock.
- Reject invalid/nonfinite quantities and valuations. Reject repeatable-read transactions whose snapshot could precede another completed issue; normal PostgREST read-committed calls remain supported.
- Preserve support.manage authorization, tenant checks, accounting entries, support completion and auditing. No real stock or support records are rewritten.
- Add Arabic messages for retry conflicts, inconsistent execution, invalid quantities and unsupported snapshot isolation.

## Verification

The original function failed the rollback regression with `support_not_approved`. The proposed function passed inside BEGIN/ROLLBACK before application. Migration `serialize_stock_issues_and_preserve_exact_retries` was then applied only to Supabase `yagbmbuevtjaqypkujaf`; the regression passed again afterward.

Synthetic authenticated fixtures verified exact replay, conflicting replay rejection, one movement/journal/execution event, insufficient-stock rejection, unchanged rejected support, NaN/null rejection, foreign-tenant warehouse/item rejection, approval-only denial and anonymous denial. All fixtures rolled back and no messages were sent.

TypeScript/Vite production build and all 31 Node tests passed. Vite retains its existing large-chunk warning.

Security Advisor counts remained: six RLS-without-policy INFO, three anonymous security-definer WARN, 108 authenticated security-definer WARN, and leaked-password protection WARN. No policies were opened to suppress these warnings.

## Limits

The stock-limit regression is sequential, not a two-session concurrency test. The locking change has been reviewed but simultaneous transactions remain unverified. Authenticated post-deployment browser behavior, full binary-document upload, password-recovery delivery, load testing and backup restoration are not certified by this change. Deployment status must be checked separately after merge.
