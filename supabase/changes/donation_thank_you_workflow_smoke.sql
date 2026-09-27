begin;

do $$
declare
  owner_uid uuid;
  donation_id uuid;
  charity_id uuid;
  r jsonb;
  status_count bigint;
begin
  select cm.user_id,d.id,d.charity_id
  into owner_uid,donation_id,charity_id
  from public.donations d
  join public.charity_members cm on cm.charity_id=d.charity_id and cm.status='active'
  join public.roles ro on ro.id=cm.role_id and ro.code='owner'
  where d.status='received'
  order by d.donated_at desc
  limit 1;

  if owner_uid is null or donation_id is null then raise exception 'fixture_missing'; end if;

  perform set_config('request.jwt.claim.sub',owner_uid::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';

  r:=public.record_donation_thank_you(
    donation_id,
    'copy',
    'Smoke thank-you message'
  );

  if nullif(r->>'id','') is null then raise exception 'thank_you_log_missing'; end if;

  select s.send_count into status_count
  from public.donation_thank_you_status(array[donation_id]) s
  where s.donation_id=donation_id;

  if coalesce(status_count,0)<1 then raise exception 'thank_you_status_failed'; end if;

  execute 'reset role';
  if not exists(
    select 1 from public.donation_thank_you_logs
    where id=(r->>'id')::uuid and charity_id=charity_id
  ) then raise exception 'tenant_binding_failed'; end if;
end $$;

rollback;
