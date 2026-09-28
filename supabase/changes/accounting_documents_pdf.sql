
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'accounting-documents','accounting-documents',false,15728640,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.accounting_voucher_attachments(
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  voucher_id uuid not null references public.accounting_vouchers(id) on delete cascade,
  document_kind text not null default 'invoice' check(document_kind in ('invoice','receipt','supporting_document')),
  title text not null,
  object_path text not null,
  mime_type text not null,
  file_size bigint not null check(file_size > 0 and file_size <= 15728640),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists accounting_voucher_attachments_charity_idx on public.accounting_voucher_attachments(charity_id,created_at desc);
create index if not exists accounting_voucher_attachments_voucher_idx on public.accounting_voucher_attachments(voucher_id,created_at desc);
create index if not exists accounting_voucher_attachments_created_by_idx on public.accounting_voucher_attachments(created_by);

alter table public.accounting_voucher_attachments enable row level security;
revoke all on table public.accounting_voucher_attachments from public,anon,authenticated;

drop policy if exists accounting_documents_select on storage.objects;
create policy accounting_documents_select
on storage.objects for select to authenticated
using(
  bucket_id='accounting-documents'
  and (storage.foldername(name))[1]=private.current_charity_id()::text
  and (private.has_permission('accounting.view') or private.has_permission('accounting.manage') or private.has_permission('audit.view'))
);

drop policy if exists accounting_documents_insert on storage.objects;
create policy accounting_documents_insert
on storage.objects for insert to authenticated
with check(
  bucket_id='accounting-documents'
  and (storage.foldername(name))[1]=private.current_charity_id()::text
  and private.has_permission('accounting.manage')
);

drop policy if exists accounting_documents_delete on storage.objects;
create policy accounting_documents_delete
on storage.objects for delete to authenticated
using(
  bucket_id='accounting-documents'
  and (storage.foldername(name))[1]=private.current_charity_id()::text
  and private.has_permission('accounting.manage')
);

create or replace function public.add_accounting_voucher_attachment(
  p_voucher_id uuid,p_document_kind text,p_title text,p_object_path text,p_mime_type text,p_file_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare c uuid:=private.current_charity_id(); v public.accounting_vouchers%rowtype; aid uuid; expected_prefix text;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('accounting.manage') then raise exception 'forbidden'; end if;
 if p_document_kind not in ('invoice','receipt','supporting_document') then raise exception 'invalid_document_kind'; end if;
 if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'title_required'; end if;
 if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') then raise exception 'invalid_mime_type'; end if;
 if coalesce(p_file_size,0)<=0 or p_file_size>15728640 then raise exception 'invalid_file_size'; end if;

 select * into v from public.accounting_vouchers where id=p_voucher_id and charity_id=c;
 if not found then raise exception 'voucher_not_found'; end if;

 expected_prefix:=c::text||'/vouchers/'||p_voucher_id::text||'/';
 if nullif(trim(coalesce(p_object_path,'')),'') is null or p_object_path not like expected_prefix||'%' then raise exception 'invalid_object_path'; end if;

 insert into public.accounting_voucher_attachments(
  charity_id,voucher_id,document_kind,title,object_path,mime_type,file_size,created_by
 ) values(
  c,p_voucher_id,p_document_kind,trim(p_title),p_object_path,p_mime_type,p_file_size,auth.uid()
 )
 returning id into aid;

 perform private.log_audit(
  c,auth.uid(),'accounting.voucher_attachment_added','accounting_voucher',p_voucher_id,null,
  jsonb_build_object('attachment_id',aid,'document_kind',p_document_kind,'title',trim(p_title))
 );

 return jsonb_build_object('id',aid,'voucher_id',p_voucher_id,'object_path',p_object_path);
end
$function$;

create or replace function public.accounting_voucher_attachments(p_voucher_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare c uuid:=private.current_charity_id(); result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not (
   private.has_permission('accounting.view')
   or private.has_permission('accounting.manage')
   or private.has_permission('audit.view')
 ) then raise exception 'forbidden'; end if;

 if not exists(select 1 from public.accounting_vouchers where id=p_voucher_id and charity_id=c) then raise exception 'voucher_not_found'; end if;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',a.id,'document_kind',a.document_kind,'title',a.title,'object_path',a.object_path,
   'mime_type',a.mime_type,'file_size',a.file_size,'created_at',a.created_at
 ) order by a.created_at desc),'[]'::jsonb)
 into result
 from public.accounting_voucher_attachments a
 where a.voucher_id=p_voucher_id and a.charity_id=c;

 return result;
end
$function$;

create or replace function public.accounting_vouchers(p_type text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare c uuid:=private.current_charity_id(); result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not (
   private.has_permission('accounting.view')
   or private.has_permission('accounting.manage')
   or private.has_permission('reports.view')
 ) then raise exception 'forbidden'; end if;

 select coalesce(jsonb_agg(to_jsonb(x) order by x.transaction_date desc,x.created_at desc),'[]'::jsonb)
 into result
 from (
  select
   v.id,v.voucher_no,v.voucher_type,v.transaction_date,v.amount,v.party_name,v.description,
   v.payment_method,v.external_reference,v.status,v.created_at,
   da.code debit_code,da.name_ar debit_account,
   ca.code credit_code,ca.name_ar credit_account,
   v.journal_entry_id,v.reversal_journal_id,
   (select count(*) from public.accounting_voucher_attachments a where a.voucher_id=v.id and a.charity_id=c) as attachment_count
  from public.accounting_vouchers v
  join public.accounting_accounts da on da.id=v.debit_account_id
  join public.accounting_accounts ca on ca.id=v.credit_account_id
  where v.charity_id=c and (p_type is null or v.voucher_type=p_type)
  limit 500
 ) x;

 return result;
end
$function$;

revoke execute on function public.add_accounting_voucher_attachment(uuid,text,text,text,text,bigint) from public,anon;
grant execute on function public.add_accounting_voucher_attachment(uuid,text,text,text,text,bigint) to authenticated;

revoke execute on function public.accounting_voucher_attachments(uuid) from public,anon;
grant execute on function public.accounting_voucher_attachments(uuid) to authenticated;
