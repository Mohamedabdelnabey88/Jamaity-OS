# Governance evidence review

During authenticated production review, governance displayed an evidence count but no way to list or open the uploaded evidence.

The existing governance_center RPC now includes evidence metadata scoped to both requirement and current charity. Its auth, membership/permission checks, empty search_path and grants remain unchanged. No private-table policy was opened. The UI lists evidence, requests a 60-second signed Storage link only on demand, and removes the link from the UI after 55 seconds. Existing private Storage SELECT policies enforce tenant and governance permission checks.

Read-only governance users no longer receive enabled modification controls. Status and upload handlers release busy state on exceptions and lock overlapping actions. A metadata-registration error after a successful upload now asks the user to refresh instead of deleting an object whose registration may have committed despite a lost response. Such uncertain uploads still require reconciliation; automatic orphan cleanup is not implemented.

Migration expose_tenant_scoped_governance_evidence was tested with rollback before application and applied only to yagbmbuevtjaqypkujaf. The rollback regression passed again afterward: own evidence visible, other tenant evidence absent, platform admin without charity membership denied, anonymous denied. Fixtures are metadata only, not binary upload tests.

TypeScript/Vite build and all 31 Node tests pass. The first build identified a nullable signed-link guard, corrected before the successful build. Security Advisor still reports the existing RLS-without-policy, security-definer-execute and leaked-password-protection categories. No claim of full security certification is made.

Post-deployment browser verification and full upload/role journeys are separate acceptance checks.
