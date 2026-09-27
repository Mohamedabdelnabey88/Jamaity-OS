begin;

do $$
declare
  v_owner_uid uuid;
  v_donation_id uuid;
  v_expected_charity uuid;
  v_result jsonb;
  v_status_count bigint;
begin
  select cm.user_id,d.id,d.charity_id
  into v_owner_uid,v_donation_id,v_expected_charity
  from public.donations d
  join public.charity_members cm on cm.charity_id=d.charity_id and cm.status='active'
  join public.roles ro on ro.id=cm.role_id and ro.code='owner'
  where d.status='received'
  order by d.donated_at desc
  limit 1;

  if v_owner_uid is null or v_donation_id is null then raise exception 'fixture_missing'; end if;

  perform set_config('request.jwt.claim.sub',v_owner_uid::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';

  v_result:=public.record_donation_thank_you(
    v_donation_id,
    'copy',
    'Smoke thank-you message'
  );

  if nullif(v_result->>'id','') is null then raise exception 'thank_you_log_missing'; end if;

  select s.send_count into v_status_count
  from public.donation_thank_you_status(array[v_donation_id]) s
  where s.donation_id=v_donation_id;

  if coalesce(v_status_count,0)<1 then raise exception 'thank_you_status_failed'; end if;

  execute 'reset role';
  if not exists(
    select 1 from public.donation_thank_you_logs l
    where l.id=(v_result->>'id')::uuid and l.charity_id=v_expected_charity
  ) then raise exception 'tenant_binding_failed'; end if;
end $$;

rollback;
