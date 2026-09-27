begin;
do $$
declare
  owner_id uuid:=gen_random_uuid();
  staff_id uuid:=gen_random_uuid();
  outsider_id uuid:=gen_random_uuid();
  admin_id uuid:=gen_random_uuid();
  c uuid;
  c2 uuid;
  role_id uuid;
  inv jsonb;
  token text;
  tampered text;
  accepted jsonb;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
  values
    (owner_id,'authenticated','authenticated','owner-'||owner_id||'@example.invalid',now(),'{}','{}'),
    (staff_id,'authenticated','authenticated','staff-'||staff_id||'@example.invalid',now(),'{}','{}'),
    (outsider_id,'authenticated','authenticated','outsider-'||outsider_id||'@example.invalid',now(),'{}','{}'),
    (admin_id,'authenticated','authenticated','admin-'||admin_id||'@example.invalid',now(),'{}','{}');

  insert into public.platform_admins(user_id) values(admin_id);

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  c:=public.register_charity('Invitation Security A',null,'أبها','عسير',null);

  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  c2:=public.register_charity('Invitation Security B',null,'أبها','عسير',null);

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.platform_set_charity_status(c,'approved');
  perform public.platform_set_charity_status(c2,'approved');

  select id into role_id from public.roles where code='case_manager' and charity_id is null limit 1;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  execute 'set local role authenticated';
  inv:=public.create_team_invitation('staff-'||staff_id||'@example.invalid',role_id);
  execute 'reset role';

  token:=inv->>'token';
  tampered:=substr(token,1,63)||case when right(token,1)='a' then 'b' else 'a' end;

  perform set_config('request.jwt.claim.sub',staff_id::text,true);
  execute 'set local role authenticated';

  begin
    perform public.accept_staff_invitation(tampered);
    raise exception 'tampered_token_accepted';
  exception when others then
    if sqlerrm<>'invitation_invalid_or_expired' then raise; end if;
  end;

  begin
    perform public.accept_staff_invitation(token,'JM-FAKE');
    raise exception 'legacy_code_endpoint_callable';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.accept_member_invitation(token);
    raise exception 'direct_member_endpoint_callable';
  exception when insufficient_privilege then null;
  end;

  accepted:=public.accept_staff_invitation(token);
  execute 'reset role';

  if (accepted->>'charity_id')::uuid<>c then raise exception 'wrong_charity_binding'; end if;
  if exists(select 1 from public.charity_members m where m.user_id=staff_id and m.charity_id<>c) then
    raise exception 'cross_charity_membership_created';
  end if;
  if not exists(select 1 from public.charity_members m where m.user_id=staff_id and m.charity_id=c and m.role_id=role_id and m.status='active') then
    raise exception 'expected_membership_missing';
  end if;
end $$;

select 'PASS: staff invitation token tampering, legacy code acceptance, direct acceptance bypass, and cross-charity binding are blocked' result;
rollback;
