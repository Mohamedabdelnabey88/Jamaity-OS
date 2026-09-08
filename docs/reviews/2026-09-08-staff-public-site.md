# Staff enrollment, public charity content and loading — 2026-09-08

Base main: c9ddc3351c6e442dc9c138454a643c313af57bfb. Only database yagbmbuevtjaqypkujaf was modified.

## Delivered

- /team shows named employees and their email, role controls, custom roles, invitation history and revocation. Owner creates a scoped invitation; employee chooses their own password. No invitation emails are sent automatically.
- Every charity receives a unique JM- sequence code, including future registrations. Codes are identifiers, not secrets or authorization. Platform directory and charity account display them.
- /staff-access accepts code plus invitation token, requires the invited verified email, and binds membership to the invitation's charity and role. Existing membership in any charity and platform accounts cannot accept a new staff invitation. Old /register?invite links remain compatible with the canonical secure acceptance function.
- Fixed existing invitation drift: create_team_invitation wrote member_invitations while accept_team_invitation read team_invitations. Both now use member_invitations. Verified both tables had zero entries before migration. Fixed pgcrypto references to extensions schema.
- Settings contains editorial management of board/leadership, cash or in-kind donation opportunities, impact stories and disclosure links. Public site combines published editorial content, published charity updates with images, programs and bank-transfer information. Internal employees, private donor transactions and beneficiary data are not automatically published. Donation opportunities are editorial content, not evidence of received money.
- Shared request timeout/cancellation for Supabase fetches, no automatic mutation retries; access-load failures have an explicit retry screen; access refreshed on focus and subscription expiry; React error boundary for rendering/chunk-load failures.
- Route code splitting: entry JavaScript fell from 620.61 kB to 396.20 kB before gzip (167.90 to 119.05 kB gzip). This is bundle measurement, not a measured end-user latency claim.

## Executed verification

- TypeScript and Vite build passed.
- Four Node tests passed: preserve mutation body, caller cancellation, timeout with no retry, Arabic code-mismatch error.
- Live database test script team_public_smoke.sql passed inside BEGIN/ROLLBACK: unique new charity code; owner creates canonical invitation; wrong email and code rejected; verified invited employee accepts; token reuse rejected; joining another charity rejected; staff public-site edit rejected; foreign-tenant content edit rejected; draft excluded from public result; published campaign included; pending charity hidden; revoked invitation rejected; outsider denied team and platform listings; platform admin sees codes; direct content grants restricted.
- SQL tests exercise real database RPCs with scoped auth.uid claims; they are not browser/Auth signup or email-delivery tests. All fixture rows rolled back; sequence gaps are normal.
- Security Advisor: 5 RLS/no-policy info entries (RPC-only tables), 2 public and 102 authenticated SECURITY DEFINER exposure notices, 1 leaked password protection warning. Performance Advisor: 47 unused index notices. No advisor notices were blindly suppressed.

## Remaining limitations

- Cloud browser navigation to local /staff-access returned ERR_BLOCKED_BY_CLIENT. Authenticated browser click-through, real signup/confirmation/recovery emails and every role's full financial/beneficiary lifecycle have NOT been verified in this release.
- Leaked-password protection remains disabled. Connected Supabase tools provide no Auth configuration mutation and no management API token is available. Enable in the current project's Authentication > Email settings; Supabase documentation says Pro or above is required. No paid upgrade was initiated. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Existing privileged RPCs beyond this release still need a complete individual authorization audit. Advisor counts do not certify security.
- Public images/documents use publisher-provided HTTPS links; direct managed media upload and full CMS revision history remain follow-up work.
