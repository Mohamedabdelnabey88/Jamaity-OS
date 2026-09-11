begin;
do $$
declare u uuid:=gen_random_uuid(); c uuid; admin_id uuid; r uuid:=gen_random_uuid(); a uuid; b uuid; jid uuid; n int;
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
 -- 201 entries prove access beyond the former client-side cap.
 for n in 1..201 loop
 perform public.accounting_post_journal(p_description=>'pagination audit '||lpad(n::text,3,'0'),p_entry_date=>current_date,p_reference_type=>'read_audit',p_reference_id=>gen_random_uuid(),p_lines=>jsonb_build_array(jsonb_build_object('account_id',a,'debit',1,'credit',0),jsonb_build_object('account_id',b,'debit',0,'credit',1)));
 end loop;
 insert into public.roles(id,code,name_ar,name_en,is_system,charity_id) values(r,'reader_'||replace(r::text,'-',''),'قارئ اختبار','Test reader',false,c);
 insert into public.role_permissions(role_id,permission_id) select r,id from public.permissions where code='accounting.view';
 update public.charity_members set role_id=r where user_id=u and charity_id=c;
 execute 'set local role authenticated';
 select count(*) into n from public.journal_entries where charity_id=c;
 if n<>201 then raise exception 'reader_count_wrong:%',n;end if;
 select count(*) into n from (select id from public.journal_entries where charity_id=c order by entry_date desc,id offset 200 limit 50) p;
 if n<>1 then raise exception 'last_page_wrong';end if;
 select count(*) into n from public.journal_entries where description ilike '%audit 201%';
 if n<>1 then raise exception 'search_failed';end if;
 select count(*) into n from public.journal_lines;
 if n<>402 then raise exception 'line_visibility_wrong:%',n;end if;
 if exists(select 1 from public.accounting_accounts where charity_id<>c) or exists(select 1 from public.journal_entries where charity_id<>c) then raise exception 'cross_tenant_read';end if;
 begin perform public.accounting_save_account(null,'DENIED','Reader denied','expense',true);raise exception 'reader_write_allowed';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';
 delete from public.role_permissions where role_id=r;
 execute 'set local role authenticated';
 if exists(select 1 from public.journal_entries) or exists(select 1 from public.journal_lines) or exists(select 1 from public.accounting_accounts) then raise exception 'unprivileged_read';end if;
 execute 'reset role';
 insert into public.role_permissions(role_id,permission_id) select r,id from public.permissions where code='accounting.manage';
 execute 'set local role authenticated';
 select count(*) into n from public.journal_entries; if n<>201 then raise exception 'manager_read_failed';end if;
 execute 'reset role';
 update public.charity_subscriptions set ends_at=now()-interval '1 second' where charity_id=c;
 execute 'set local role authenticated';
 if exists(select 1 from public.journal_entries) then raise exception 'expired_read';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 if exists(select 1 from public.journal_entries) then raise exception 'platform_read';end if;
 execute 'reset role';
end $$;
select 'PASS: 201 entries, final page, search, accounting.view/manage, read-only write denial, tenant isolation, no permission, expiry, platform isolation' result;
rollback;
