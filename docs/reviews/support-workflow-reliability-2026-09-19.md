# Support workflow reliability follow-up

Baseline main: `886025f49092df212f43a1fa955995470426d808`.

## Changes

- The support form previously created a fresh idempotency key on every submission. If the server saved the operation but its response was lost, a manual retry could create a second request. Unchanged submissions now retain their reference while the page remains mounted, including closing and reopening the form. A changed payload or confirmed success begins a new operation. References are not persisted across page reloads.
- A synchronous mutation lock prevents overlapping clicks before React updates disabled controls. Create and stock-issue forms disable editing and dismissal during submission.
- Failures appear inside the active dialog, with Arabic messages for common support/stock errors.
- Creation and execution require support.manage in the UI; approval/rejection requires support.approve. Beneficiary-request review uses either permission, matching its RPC. Stock selection also requires inventory.manage. These controls supplement existing server authorization; no database grants are expanded.
- Out-of-order list responses are ignored after a new filter/load or unmount.

## Verification

- Authenticated production browser before changes: beneficiary list and profile load; seven document actions are visible; the profile's add-support link opens the form with the beneficiary selected. No support was created for the real beneficiary.
- New retry-key tests model a lost response and verify that an unchanged retry uses one operation reference. Changed payloads and confirmed-success resets get new references.
- New SQL suite uses synthetic users, a charity and roles under BEGIN/ROLLBACK. Replaying the same reference returns one support row and one creation event. A support manager cannot approve without approval permission. An approval-only role can approve but cannot create or execute support.
- TypeScript/Vite build and 31 Node tests passed. The pre-existing optional Excel bundle size warning remains.

This release requires no database migration. The SQL file is a rollback-only regression test. Real charity records and invitation emails were not modified or sent. Download/report acceptance is deferred to the user. Full binary uploads, browser journeys for every role, real-user performance, password-leak protection and disaster-recovery testing remain outside the completed checks.
