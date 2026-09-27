# Operational form review

Baseline: c885bf82813986be379c62db7c08247237e19795 (PR29).

## Findings and changes

- The donation form carried description, planned quantity and unit in state/RPC arguments but exposed none of them for in-kind donations. Add required fields and finite positive amount/quantity validation. Prefill receipt quantity from the selected donation and reset other receipt fields when selecting a different donation.
- Donor, donation and inventory errors appeared behind their open modal. Display them inside the form too, preserve input on failure, and prevent closing/editing while submitting.
- Add synchronous submission locks. Restore busy state in finally, including cash receipt and donor creation transport errors. These locks prevent overlapping clicks, not retries after an unknown committed response; server idempotency for creation remains future work.
- Bound reads with the existing deadline helper, cancel their UI lifecycle on unmount or replacement, and ignore stale responses. Keep independent requests parallel. This does not automatically retry writes.
- Expose pledged/cancelled donation filters and disclose existing 100 donation / 200 donor list limits. This is not server-side pagination.

## Validation

TypeScript/Vite production build and all 31 existing Node tests passed. Re-ran accounting_integrity_smoke.sql on authorized Supabase yagbmbuevtjaqypkujaf: all 15 results passed with BEGIN/ROLLBACK, covering trial access, voucher types and reversals, budget period totals, cash and in-kind donation posting, stock receipt and closed-period denial. These SQL fixtures exercise database logic; they are not browser form submissions or a complete RLS audit.

No schema, policies or grants changed. No real charity records were saved and no messages were sent. Authenticated browser testing resumed on 27 September; publication and post-deployment checks must be tracked separately.

## Remaining acceptance work

Full role-by-role browser writes need isolated test accounts/fixtures. Binary upload and recovery email delivery, simultaneous stock sessions, load testing, backup restoration and independent security review remain unverified. Remaining product gaps include complete list pagination, creation retry idempotency, and verified campaign-to-donation-to-support impact linkage. This release is not an all-buttons or launch-readiness certification.
