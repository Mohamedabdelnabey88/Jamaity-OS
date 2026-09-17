begin;
do $$
declare u uuid:=gen_random_uuid(); c uuid; admin_id uuid; r uuid:=gen_random_uuid(); a uuid; b uuid; jid uuid; n int; result jsonb; fp uuid; expense uuid;
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


 select id into expense from public.accounting_accounts where charity_id=c and code='5200';
 perform public.accounting_post_journal('previous day',jsonb_build_array(jsonb_build_object('account_id',expense,'debit',200),jsonb_build_object('account_id',a,'credit',200)),'2026-09-01'::date);
 perform public.accounting_post_journal('selected day',jsonb_build_array(jsonb_build_object('account_id',expense,'debit',75),jsonb_build_object('account_id',a,'credit',75)),'2026-09-02'::date);
 perform public.accounting_post_journal('following day',jsonb_build_array(jsonb_build_object('account_id',expense,'debit',300),jsonb_build_object('account_id',a,'credit',300)),'2026-09-03'::date);
 result:=public.monthly_management_report('2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03');
 if (result->'financial'->>'expense')::numeric<>75 then raise exception 'wrong_saudi_day_expense:%',result->'financial';end if;
 if not exists(select 1 from jsonb_array_elements(result->'trial_balance') x where x->>'code'='5200' and (x->>'debit')::numeric=75) then raise exception 'wrong_trial_boundary';end if;
 insert into public.roles(id,code,name_ar,name_en,is_system,charity_id) values(r,'report_'||replace(r::text,'-',''),'قارئ تقارير اختبار','Test reports',false,c);
 insert into public.role_permissions(role_id,permission_id) select r,id from public.permissions where code='reports.view';
 update public.charity_members set role_id=r where user_id=u and charity_id=c;
 execute 'set local role authenticated';
 result:=public.monthly_management_report('2026-09-02T00:00:00+03','2026-09-02T23:59:59.999999+03');
 if (result->'financial'->>'expense')::numeric<>75 then raise exception 'reports_only_finance_wrong';end if;
 if result->'operational'<>'null'::jsonb or result->'inventory_balances'<>'null'::jsonb or result->'governance'<>'null'::jsonb or result->'period_activity'->'cases_created'<>'null'::jsonb then raise exception 'unauthorized_section';end if;
 begin perform public.monthly_management_report(null,now());raise exception 'null_accepted';exception when others then if sqlerrm<>'invalid_period' then raise;end if;end;
 begin perform public.monthly_management_report(now(),now()-interval '1 day');raise exception 'reversed_accepted';exception when others then if sqlerrm<>'invalid_period' then raise;end if;end;
 execute 'reset role';
 delete from public.role_permissions where role_id=r;
 execute 'set local role authenticated';
 begin perform public.monthly_management_report();raise exception 'missing_permission_accepted';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 begin perform public.monthly_management_report();raise exception 'platform_accepted';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'set local role anon';
 begin perform public.monthly_management_report();raise exception 'anon_accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
select 'PASS: Saudi day boundaries, trial/income agreement, reports-only access, hidden module data, invalid dates, denied role/platform/anon' result;
rollback;
