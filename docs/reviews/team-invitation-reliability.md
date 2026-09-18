# Team invitations and role protection — 2026-09-18

Authenticated browser reproduction: the invitation UI sent a malformed email and displayed raw `invalid_email` above the page. The email input was not inside a form, so browser email validation never ran. Valid invitation creation was tested with isolated SQL fixtures and already worked; no email-regex database repair was needed.

Changes:
- Dedicated invitation form with native required/email validation, explicit role selection and Arabic inline errors.
- A synchronous submission lock, disabled fields during saving, finally cleanup and a retained success link prevent confusing retry/refresh behavior.
- No automatic clipboard writes. Copy is an explicit action with success/failure feedback. The label clarifies that the employee chooses their password and no email is automatically sent.
- Team mutations clean up busy state on rejection. Refresh preserves the form. Self-permission controls are visibly disabled with an explanation instead of silently doing nothing.
- The database set_role_permission RPC previously allowed edits to shared system roles despite the UI treating them as read-only. A synthetic shared role reproduced this inside ROLLBACK. The RPC now enforces read-only system roles and same-charity custom roles. No shared production role permissions were modified during testing.

Database migration: protect_shared_system_roles_from_charity_edits on yagbmbuevtjaqypkujaf only.

Validation: production build and 29 existing Node tests passed. SQL test uses only synthetic users, charities and roles with BEGIN/ROLLBACK. Valid and malformed emails, normalization, duplicate/member invitations, tenant role validation, acceptance, wrong email/code, token reuse, revoked invitation, anonymous/staff denial, custom role editing and shared/foreign role denial are covered. The new shared-role assertion failed before the fix and passed with the fix.

Beneficiary follow-up: authenticated production browser showed seven document actions in the existing profile, successfully generated a protected viewing link and opened the manual-add form without saving. Binary upload/download and full support-fulfillment browser journey remain unverified. No real charity records were created/changed, and no invitation emails were sent for testing.
