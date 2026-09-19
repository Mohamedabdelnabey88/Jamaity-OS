begin;
do $$
declare u uuid:=gen_random_uuid();u2 uuid:=gen_random_uuid();c uuid;c2 uuid;admin_id uuid;donor uuid:=gen_random_uuid();beneficiary uuid:=gen_random_uuid();r uuid:=gen_random_uuid();result jsonb;first_ids text[];second_ids text[];
begin
 admin_id:=gen_random_uuid();
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) values(admin_id,'authenticated','authenticated','report-admin-'||admin_id||'@example.invalid',now(),'{}','{}');
 insert into public.platform_admins(user_id,role,status) values(admin_id,'super_admin','active');
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 select x,'authenticated','authenticated','report-smoke-'||x||'@example.invalid',now(),'{}','{}' from unnest(array[u,u2]) x;
 perform set_config('request.jwt.claim.sub',u::text,true);c:=public.register_charity('Report rollback A',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',u2::text,true);c2:=public.register_charity('Report rollback B',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform public.platform_set_charity_status(c,'approved');perform public.platform_set_charity_status(c2,'approved');
 insert into public.donors(id,charity_id,full_name) values(donor,c,'Synthetic donor');
 insert into public.donations(charity_id,donor_id,donation_type,amount,reference_no,status,donated_at)
 select c,donor,'cash',10,'REPORT-'||n,'pending','2026-09-02T12:00:00+03' from generate_series(1,53) n;
 insert into public.donations(charity_id,donor_id,donation_type,amount,reference_no,status,donated_at)
 values(c,donor,'cash',999,'previous','pending','2026-09-01T23:59:59+03'),(c,donor,'cash',999,'following','pending','2026-09-03T00:00:00+03'),(c,donor,'in_kind',500,'literal%_','pending','2026-09-02T15:00:00+03');
 insert into public.beneficiaries(id,charity_id,full_name) values(beneficiary,c,'Synthetic private name');
 insert into public.support_records(charity_id,beneficiary_id,support_type,amount,status,created_at,notes)
 values(c,beneficiary,'financial',75,'pending','2026-09-02T12:00:00+03','private note'),
 (c,beneficiary,'cash',125,'pending','2026-09-02T13:00:00+03','private note'),
 (c,beneficiary,'in_kind',900,'pending','2026-09-02T14:00:00+03','private note');
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 result:=public.operational_report_page('donations','2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03','pending');
 if (result->>'total_rows')::int<>54 or (result->>'cash_amount_total')::numeric<>530 or jsonb_array_length(result->'rows')<>50 then raise exception 'wrong_donation_totals';end if;
 select array_agg(x->>'id') into first_ids from jsonb_array_elements(result->'rows') x;
 result:=public.operational_report_page('donations','2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03','pending','',2);
 select array_agg(x->>'id') into second_ids from jsonb_array_elements(result->'rows') x;
 if cardinality(second_ids)<>4 or first_ids&&second_ids then raise exception 'wrong_pagination';end if;
 result:=public.operational_report_page('donations','2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03',null,'%_');
 if (result->>'total_rows')::int<>1 then raise exception 'search_not_literal';end if;
 result:=public.operational_report_page('donations','2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03','rejected');
 if (result->>'total_rows')::int<>0 then raise exception 'wrong_status_filter';end if;
 result:=public.operational_report_page('support','2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03');
 if (result->>'cash_amount_total')::numeric<>200 or (result->>'total_rows')::int<>3 then raise exception 'wrong_support_totals';end if;
 if result::text like '%private note%' or result::text like '%Synthetic private name%' or (result->'rows'->0)?'beneficiary_id' then raise exception 'private_data_in_export';end if;
 result:=public.operational_report_page('support','2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03',null,'',2,1);
 if (result->>'cash_amount_total')::numeric<>200 or jsonb_array_length(result->'rows')<>1 then raise exception 'support_total_depends_on_page';end if;
 begin perform public.operational_report_page('support',now(),now(),null,'',0);raise exception 'bad_page_accepted';exception when others then if sqlerrm<>'invalid_pagination' then raise;end if;end;
 begin perform public.operational_report_page('support',null,now());raise exception 'bad_dates_accepted';exception when others then if sqlerrm<>'invalid_period' then raise;end if;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',u2::text,true);execute 'set local role authenticated';
 result:=public.operational_report_page('donations','2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03');
 if (result->>'total_rows')::int<>0 then raise exception 'cross_tenant_data';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.roles(id,code,name_ar,name_en,is_system,charity_id) values(r,'detail_'||replace(r::text,'-',''),'اختبار','Test',false,c);
 insert into public.role_permissions(role_id,permission_id) select r,id from public.permissions where code='reports.view';
 update public.charity_members set role_id=r where user_id=u and charity_id=c;
 execute 'set local role authenticated';
 begin perform public.operational_report_page('donations',now(),now());raise exception 'module_permission_missing';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';
 insert into public.role_permissions(role_id,permission_id) select r,id from public.permissions where code='donations.manage';
 execute 'set local role authenticated';
 result:=public.operational_report_page('donations','2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03');
 if (result->>'total_rows')::int<>54 then raise exception 'valid_role_denied';end if;
 execute 'reset role';delete from public.role_permissions where role_id=r and permission_id=(select id from public.permissions where code='reports.view');
 execute 'set local role authenticated';
 begin perform public.operational_report_page('donations',now(),now());raise exception 'reports_permission_missing';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',admin_id::text,true);execute 'set local role authenticated';
 begin perform public.operational_report_page('donations',now(),now());raise exception 'platform_allowed';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';execute 'set local role anon';
 begin perform public.operational_report_page('donations',now(),now());raise exception 'anon_allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
select 'PASS: totals, Saudi boundaries, paging, literal search, statuses, module/report permissions, tenant isolation, platform/anon denial, private-field exclusion' result;
rollback;
