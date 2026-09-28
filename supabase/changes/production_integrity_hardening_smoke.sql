
begin;

do $$
declare
  v_owner uuid;
  v_charity uuid;
  v_beneficiary uuid;
  v_donor uuid;
  v_donation uuid;
  v_case_result jsonb;
  v_case uuid;
  donation_update_blocked boolean:=false;
  case_update_blocked boolean:=false;
begin
  select cm.user_id,cm.charity_id
  into v_owner,v_charity
  from public.charity_members cm
  join public.roles r on r.id=cm.role_id
  where cm.status='active' and r.code='owner'
  order by cm.created_at
  limit 1;

  select id into v_beneficiary
  from public.beneficiaries
  where charity_id=v_charity
  order by created_at
  limit 1;

  if v_owner is null or v_beneficiary is null then
    raise exception 'fixture_missing';
  end if;

  insert into public.donors(charity_id,full_name,donor_type)
  values(v_charity,'متبرع اختبار تشديد الإنتاج','individual')
  returning id into v_donor;

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';

  v_donation:=public.create_donation(v_donor,'cash',100,'AUDIT-HARDEN',now());

  begin
    update public.donations set status='received',amount=999999 where id=v_donation;
  exception when insufficient_privilege then
    donation_update_blocked:=true;
  end;
  if not donation_update_blocked then raise exception 'direct_donation_update_allowed'; end if;

  perform public.approve_donation(v_donation);
  perform public.receive_donation(v_donation);

  if not exists(
    select 1 from public.donations
    where id=v_donation and status='received' and amount=100
  ) then raise exception 'donation_rpc_lifecycle_failed'; end if;

  if not exists(
    select 1 from public.journal_entries
    where reference_type='donation' and reference_id=v_donation and status='posted'
  ) then raise exception 'donation_accounting_missing'; end if;

  v_case_result:=public.create_case(v_beneficiary,'حالة اختبار تشديد الإنتاج','normal');
  v_case:=(v_case_result->>'id')::uuid;

  begin
    update public.cases set status='closed' where id=v_case;
  exception when insufficient_privilege then
    case_update_blocked:=true;
  end;
  if not case_update_blocked then raise exception 'direct_case_update_allowed'; end if;

  perform public.transition_case(v_case,'under_review');
  if not exists(select 1 from public.cases where id=v_case and status='under_review') then
    raise exception 'case_rpc_transition_failed';
  end if;

  if exists(
    select 1 from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='accounting_documents_delete'
  ) then raise exception 'accounting_document_delete_policy_still_present'; end if;
end $$;

select 'PASS: financial/case mutations are RPC-only and accounting evidence is append-only' result;

rollback;
