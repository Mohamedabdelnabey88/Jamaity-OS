# Beneficiary profile loading follow-up

Baseline: `679522daaddb25af66f3dc20a0daea2930280c3a` (PR27), verified against remote main over Git.

## Repair

The profile previously displayed empty related sections before reads completed and discarded both section results when either query failed. The invitation handler also lacked a finally block for transport exceptions.

- Clear the previous beneficiary's section and invitation state on navigation.
- Bound profile/section reads with the existing deadline helper and abort on unmount or retry.
- Show loading, failure and empty states separately for cases and support; a failed section does not hide a successful section.
- Display unknown counts as a dash and label the existing 50-record limits.
- Add a retry action for failed reads without automatically retrying writes.
- Release the invitation button in finally, lock duplicate clicks, disable email editing while submitting, and ignore responses belonging to a previous profile.

No database function, policy or grant is changed. No real invitation or charity record was created during verification.

## Verification and limitations

TypeScript/Vite production build and all 31 Node tests passed locally, including eight deadline/request tests. The initial build exposed an abortSignal chain-order error; it was corrected before the successful build.

During preparation, GitHub and Supabase connectors returned HTTP 400 / Invalid MCP request metadata. After reconnection on 22 September, a GitHub main read and a read-only query on the authorized Supabase project both succeeded. The browser's previous authenticated session was not retained, so post-release authenticated UI behavior is not asserted here.

Stock concurrency remains an open investigation: the issue_in_kind definition retrieved on 19 September locked the support row but showed no shared item/warehouse stock lock, and checked the already-executed movement after the approval-state check. Current function, trigger and grant definitions must be reread, and concurrent transactions must be tested before changing the live stock workflow. No unverified stock migration was applied.
