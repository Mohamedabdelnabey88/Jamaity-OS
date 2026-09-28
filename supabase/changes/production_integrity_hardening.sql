
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
drop policy if exists accounting_documents_delete_unregistered on storage.objects;
create policy accounting_documents_delete_unregistered
on storage.objects
for delete
to authenticated
using(
  bucket_id='accounting-documents'
  and (storage.foldername(name))[1]=private.current_charity_id()::text
  and private.has_permission('accounting.manage')
  and not exists(
    select 1
    from public.accounting_voucher_attachments a
    where a.charity_id=private.current_charity_id()
      and a.object_path=storage.objects.name
  )
);
comment on table public.accounting_voucher_attachments is
'Linked accounting evidence is immutable. Storage deletion is allowed only for uploaded objects that have not been registered to a voucher, so failed uploads can be cleaned safely.';
