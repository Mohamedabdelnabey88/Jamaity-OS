-- Transactional smoke for member permission override semantics
begin;

do $$
declare
 owner_uid uuid;
 target_member uuid;
 target_user uuid;
 reports_permission uuid;
 donors_manage_permission uuid;
 x jsonb;
begin
 select cm.user_id into owner_uid
 from public.charity_members cm
 join public.roles r on r.id=cm.role_id
 where r.code='owner' and cm.status='active'
 order by cm.created_at
 limit 1;

 select cm.id,cm.user_id into target_member,target_user
 from public.charity_members cm
 join public.roles r on r.id=cm.role_id
 where r.code='finance' and cm.status='active'
 order by cm.created_at desc
 limit 1;

 select id into reports_permission from public.permissions where code='reports.view';
 select id into donors_manage_permission from public.permissions where code='donors.manage';

 if owner_uid is null or target_member is null then
   raise exception 'smoke_fixture_missing';
 end if;

 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';

 perform public.set_member_permission(target_member,reports_permission,'deny');

 execute 'reset role';
 perform set_config('request.jwt.claim.sub',target_user::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';
 x:=public.current_access_state();
 if (x->'permissions') ? 'reports.view' then raise exception 'deny_override_failed'; end if;

 execute 'reset role';
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';
 perform public.clear_member_permission(target_member,reports_permission);
 perform public.set_member_permission(target_member,donors_manage_permission,'allow');

 execute 'reset role';
 perform set_config('request.jwt.claim.sub',target_user::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';
 x:=public.current_access_state();
 if not ((x->'permissions') ? 'reports.view') then raise exception 'inherit_restore_failed'; end if;
 if not ((x->'permissions') ? 'donors.manage') then raise exception 'allow_override_failed'; end if;

 execute 'reset role';
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';
 perform public.clear_member_permission(target_member,donors_manage_permission);

 execute 'reset role';
 perform set_config('request.jwt.claim.sub',target_user::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';
 x:=public.current_access_state();
 if (x->'permissions') ? 'donors.manage' then raise exception 'allow_clear_failed'; end if;
end $$;

rollback;
