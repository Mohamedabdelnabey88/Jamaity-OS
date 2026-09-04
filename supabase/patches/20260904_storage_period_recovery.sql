-- Fix Storage policy permission failures without exposing beneficiary applications.
create or replace function private.can_access_beneficiary_application_object(p_name text,p_write boolean default false)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists(
  select 1 from public.beneficiary_applications a
  where a.user_id=auth.uid()
    and a.charity_id::text=(storage.foldername(p_name))[1]
    and a.id::text=(storage.foldername(p_name))[2]
    and (not p_write or a.status in('submitted','under_review','approved'))
 )
$$;

create or replace function private.can_review_beneficiary_application_object(p_name text)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists(
  select 1 from public.beneficiary_applications a
  where a.charity_id=private.current_charity_id()
    and a.charity_id::text=(storage.foldername(p_name))[1]
    and a.id::text=(storage.foldername(p_name))[2]
    and (private.has_permission('beneficiaries.view') or private.has_permission('beneficiaries.manage'))
 )
$$;

revoke all on function private.can_access_beneficiary_application_object(text,boolean) from public,anon;
revoke all on function private.can_review_beneficiary_application_object(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.can_access_beneficiary_application_object(text,boolean) to authenticated;
grant execute on function private.can_review_beneficiary_application_object(text) to authenticated;

drop policy if exists beneficiary_application_documents_self_insert on storage.objects;
drop policy if exists beneficiary_application_documents_self_select on storage.objects;
drop policy if exists beneficiary_application_documents_self_delete on storage.objects;
drop policy if exists beneficiary_application_documents_staff_select on storage.objects;

create policy beneficiary_application_documents_self_insert on storage.objects
 for insert to authenticated with check(
  bucket_id='beneficiary-documents' and private.can_access_beneficiary_application_object(name,true)
 );
create policy beneficiary_application_documents_self_select on storage.objects
 for select to authenticated using(
  bucket_id='beneficiary-documents' and private.can_access_beneficiary_application_object(name,false)
 );
create policy beneficiary_application_documents_self_delete on storage.objects
 for delete to authenticated using(
  bucket_id='beneficiary-documents' and private.can_access_beneficiary_application_object(name,true)
 );
create policy beneficiary_application_documents_staff_select on storage.objects
 for select to authenticated using(
  bucket_id='beneficiary-documents' and private.can_review_beneficiary_application_object(name)
 );

create or replace function public.accounting_update_period(p_period_id uuid,p_name text,p_starts_on date,p_ends_on date)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); old_row public.accounting_fiscal_periods%rowtype; new_row public.accounting_fiscal_periods%rowtype;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('accounting.manage') then raise exception 'forbidden'; end if;
 if p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on or nullif(trim(p_name),'') is null then raise exception 'invalid_period'; end if;
 select * into old_row from public.accounting_fiscal_periods where id=p_period_id and charity_id=c for update;
 if not found then raise exception 'period_not_found'; end if;
 if old_row.status='closed' then raise exception 'reopen_period_before_edit'; end if;
 if exists(select 1 from public.accounting_fiscal_periods where charity_id=c and id<>p_period_id and daterange(starts_on,ends_on,'[]') && daterange(p_starts_on,p_ends_on,'[]')) then raise exception 'period_overlap'; end if;
 update public.accounting_fiscal_periods set name=trim(p_name),starts_on=p_starts_on,ends_on=p_ends_on where id=p_period_id returning * into new_row;
 perform private.log_audit(c,auth.uid(),'accounting.period_updated','accounting_fiscal_period',p_period_id,to_jsonb(old_row),to_jsonb(new_row));
 return jsonb_build_object('id',p_period_id,'status','updated');
end $$;

create or replace function public.accounting_reopen_period(p_period_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); old_row public.accounting_fiscal_periods%rowtype;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('accounting.manage') then raise exception 'forbidden'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;
 select * into old_row from public.accounting_fiscal_periods where id=p_period_id and charity_id=c for update;
 if not found then raise exception 'period_not_found'; end if;
 if old_row.status='open' then return jsonb_build_object('id',p_period_id,'status','open','duplicate',true); end if;
 update public.accounting_fiscal_periods set status='open',closed_by=null,closed_at=null where id=p_period_id;
 perform private.log_audit(c,auth.uid(),'accounting.period_reopened','accounting_fiscal_period',p_period_id,to_jsonb(old_row),jsonb_build_object('status','open','reason',trim(p_reason)));
 return jsonb_build_object('id',p_period_id,'status','open','duplicate',false);
end $$;

revoke all on function public.accounting_update_period(uuid,text,date,date) from public,anon;
revoke all on function public.accounting_reopen_period(uuid,text) from public,anon;
grant execute on function public.accounting_update_period(uuid,text,date,date) to authenticated;
grant execute on function public.accounting_reopen_period(uuid,text) to authenticated;
