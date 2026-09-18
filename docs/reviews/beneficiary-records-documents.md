# Beneficiary records and document visibility — 2026-09-18

The beneficiaries toolbar had an inert New Beneficiary button. Approved application evidence remained in beneficiary_application_documents while the staff profile queried only beneficiary_documents.

This change adds a tenant-scoped document RPC combining approved application evidence and direct file documents without copying files or weakening Storage policies. It displays source/review labels, explicit empty/error/loading states, permission-aware controls and short-lived links. Application evidence is read-only in the profile. The section now appears immediately below the profile header.

Manual creation requires beneficiaries.manage and an active tenant. It validates name/phone, records an audit event and uses a stable request UUID for retry protection. A manually created record is inactive and does not automatically create a portal account or approve eligibility. The form explains this. Existing household/evidence approval rules remain intact.

Applied migration: repair_beneficiary_document_visibility_and_manual_creation, project yagbmbuevtjaqypkujaf only.

Verification:
- TypeScript and Vite production build passed.
- 29 existing Node tests passed.
- New SQL smoke passed before and after application using BEGIN/ROLLBACK and synthetic users/charities. It covers application approval and evidence visibility, reader permissions, cross-tenant isolation, platform-only and anonymous denial, manual inactive creation, validation and same-request retry without duplication.
- Read-only check for the user-reported charity confirmed active workspace access and seven visible application document records. No real beneficiary data changed.

Limits: SQL document fixtures are metadata, not binary uploads. Authenticated browser verification and full upload/download journey are not claimed by this test. Manual addition does not collect or verify national identity, nor deduplicate by identity. A failed/ambiguous upload metadata registration asks the user to refresh rather than deleting potentially registered storage content. Detailed end-to-end support fulfillment was not rerun in this change. Existing report bundle size warnings remain.
