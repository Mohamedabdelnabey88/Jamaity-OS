begin;
do $$
declare u uuid:=gen_random_uuid(); c uuid; admin_id uuid; r uuid:=gen_random_uuid(); a uuid; b uuid; jid uuid; n int; result jsonb; pg text;
begin
 select user_id into admin_id from public.platform_admins where status='active' and role='super_admin' limit 1;
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 values(u,'authenticated','authenticated','read-audit-'||u||'@example.invalid',now(),'{}','{}');
 perform set_config('request.jwt.claim.sub',u::text,true);
 c:=public.register_charity('Rollback accounting reader',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.platform_set_charity_status(c,'approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.accounting_initialize();
 select id into a from public.accounting_accounts where charity_id=c and code='1100';
 select id into b from public.accounting_accounts where charity_id=c and code='4100';

 foreach pg in array array['dashboard','donors','donations','accounting','inventory'] loop
 result:=public.workspace_smart_insights(pg);
 if jsonb_typeof(result->'items')<>'array' then raise exception 'invalid_insights';end if;
 end loop;
 insert into public.roles(id,code,name_ar,name_en,is_system,charity_id) values(r,'isolated_'||replace(r::text,'-',''),'دور اختبار','Test',false,c);
 update public.charity_members set role_id=r where user_id=u and charity_id=c;
 execute 'set local role authenticated';
 result:=public.workspace_smart_insights('dashboard');
 if result->'items'<>'[]'::jsonb then raise exception 'unauthorized_module_insights';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 begin perform public.workspace_smart_insights('dashboard');raise exception 'platform_access_allowed';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'set local role anon';
 begin perform public.workspace_smart_insights('dashboard');raise exception 'anon_allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
select 'PASS: five insight pages, module permissions, platform and anonymous isolation' result;
rollback;
