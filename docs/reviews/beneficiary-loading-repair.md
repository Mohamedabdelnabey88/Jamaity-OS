# Beneficiary portal read recovery

Baseline: 2f9b6a719e86e67e302356bd06212051bee17249.

The portal loader did not catch rejected promises, could leave its spinner active, and rendered nothing for a null response. Add a 25-second deadline covering work before fetch, transport cancellation, error/retry/application-status UI, rejection handling, and stale-result guards on refresh/unmount. Existing server authorization remains unchanged.

Four unit regressions cover stalled reads, success/rejection cleanup, cancellation, and pre-cancelled requests. GitHub CI must run these plus the existing tests and production build before merge. Local execution and authenticated browser verification are unavailable while the execution environment is offline. This does not prove the complete beneficiary journey, document upload, or all permission-denied cases are fixed.

No database changes, real data edits or emails. Dependency upgrades attempted locally before the environment disconnected are not part of this release and remain pending.
