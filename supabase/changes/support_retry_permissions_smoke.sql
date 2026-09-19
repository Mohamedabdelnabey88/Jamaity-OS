begin;
do $$
declare
 u uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); c uuid;
 b uuid:=gen_random_uuid(); test_role uuid:=gen_random_uuid();
 first_record public.support_records; retry_record public.support_records;
 operation_key text:='rollback-'||gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 select x,'authenticated','authenticated','support-retry-'||x||'@example.invalid',now(),'{}','{}' from unnest(array[u,admin_id]) x;
 insert into public.platform_admins(user_id) values(admin_id);
 perform set_config('request.jwt.claim.sub',u::text,true);
 c:=public.register_charity('Rollback support retries',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.platform_set_charity_status(c,'approved');
 insert into public.beneficiaries(id,charity_id,full_name) values(b,c,'Synthetic beneficiary');
 insert into public.roles(id,code,name_ar,name_en,is_system,charity_id)
 values(test_role,'retry_'||replace(test_role::text,'-',''),'اختبار','Test',false,c);
 insert into public.role_permissions(role_id,permission_id) select test_role,id from public.permissions where code='support.manage';
 update public.charity_members set role_id=test_role where charity_id=c and user_id=u;
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 first_record:=public.create_support_request(b,'cash',125,null,null,'Synthetic retry',operation_key);
 retry_record:=public.create_support_request(b,'cash',125,null,null,'Synthetic retry',operation_key);
 if first_record.id<>retry_record.id then raise exception 'retry_created_duplicate';end if;
 begin perform public.approve_support(first_record.id);raise exception 'manager_approved_without_permission';
 exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';
 if (select count(*) from public.support_records where charity_id=c and idempotency_key=operation_key)<>1 then raise exception 'duplicate_support';end if;
 if (select count(*) from public.support_events where support_record_id=first_record.id and event_type='created')<>1 then raise exception 'duplicate_creation_event';end if;
 delete from public.role_permissions where role_id=test_role;
 insert into public.role_permissions(role_id,permission_id) select test_role,id from public.permissions where code='support.approve';
 execute 'set local role authenticated';
 begin perform public.create_support_request(b,'cash',125,null,null,null,operation_key||'-new');raise exception 'approver_created_without_permission';
 exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 perform public.approve_support(first_record.id);
 begin perform public.execute_support(first_record.id);raise exception 'approver_executed_without_permission';
 exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';
end $$;
select 'PASS: retry produces one support/event; manager cannot approve; approver can approve but cannot create or execute' result;
rollback;
