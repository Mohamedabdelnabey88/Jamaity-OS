begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();a uuid:=gen_random_uuid();c uuid;other_c uuid;req uuid;ev uuid:=gen_random_uuid();data jsonb;other_req uuid;
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 select x,'authenticated','authenticated','gov-smoke-'||x||'@example.invalid',now(),'{}','{}' from unnest(array[u,v,a])x;
 insert into public.platform_admins(user_id) values(a);
 perform set_config('request.jwt.claim.sub',u::text,true);c:=public.register_charity('Rollback evidence owner',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',v::text,true);other_c:=public.register_charity('Rollback evidence other',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.platform_set_charity_status(c,'approved');perform public.platform_set_charity_status(other_c,'approved');
 perform set_config('request.jwt.claim.sub',u::text,true);data:=public.governance_center();req:=(data->'items'->0->>'id')::uuid;
 insert into public.governance_evidence(id,charity_id,requirement_id,title_ar,object_path,created_by) values(ev,c,req,'Synthetic evidence',c||'/'||req||'/test.pdf',u);
 execute 'set local role authenticated';data:=public.governance_center();
 if not exists(select 1 from jsonb_array_elements(data->'items') i,jsonb_array_elements(i->'evidence') e where e->>'id'=ev::text and e->>'title_ar'='Synthetic evidence' and e->>'object_path'=c||'/'||req||'/test.pdf') then raise exception 'evidence_not_exposed_to_owner';end if;
 perform set_config('request.jwt.claim.sub',v::text,true);data:=public.governance_center();
 if exists(select 1 from jsonb_array_elements(data->'items') i,jsonb_array_elements(i->'evidence') e where e->>'id'=ev::text) then raise exception 'cross_tenant_evidence';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin perform public.governance_center();raise exception 'platform_admin_without_membership_allowed';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub','',true);execute 'set local role anon';
 begin perform public.governance_center();raise exception 'anon_allowed';exception when insufficient_privilege then null;when others then if sqlerrm<>'not_authenticated' then raise;end if;end;
 execute 'reset role';
end $$;
select 'PASS: own evidence list, cross-tenant isolation, platform-admin-without-membership denial, anonymous denial; metadata fixtures only' result;
rollback;
