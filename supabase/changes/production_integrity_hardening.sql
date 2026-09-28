
-- Production integrity hardening discovered during September 2026 readiness audit.
-- 1) Donation lifecycle mutations are RPC-only.
-- 2) Case lifecycle mutations are RPC-only.
-- 3) Accounting evidence files are append-only once linked.

revoke insert, update, delete on table public.donations from authenticated;
drop policy if exists donations_insert on public.donations;
drop policy if exists donations_update on public.donations;
drop policy if exists donations_delete on public.donations;
comment on table public.donations is
'Donation lifecycle mutations are RPC-only. Authenticated clients may read tenant-scoped rows; create/approve/receive/reject must use validated SECURITY DEFINER workflows.';

revoke insert, update, delete on table public.cases from authenticated;
drop policy if exists cases_insert on public.cases;
drop policy if exists cases_update on public.cases;
drop policy if exists cases_delete on public.cases;
comment on table public.cases is
'Case lifecycle mutations are RPC-only. Authenticated clients may read tenant-scoped rows; creation and status transitions must use validated workflows.';

drop policy if exists accounting_documents_delete on storage.objects;
comment on table public.accounting_voucher_attachments is
'Immutable accounting evidence metadata. Files are private and append-only once linked to a voucher; corrections are made by adding a new supporting document rather than deleting history.';
