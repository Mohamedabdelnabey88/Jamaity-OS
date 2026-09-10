begin;
create temp table audit_results(test text,status text,detail text);
do $$
declare u uuid:=gen_random_uuid(); admin_id uuid; c uuid; initial_start timestamptz; initial_end timestamptz; data jsonb; fp uuid; cash uuid; expense uuid; revenue uuid; journal uuid; budget uuid; donor uuid; donation uuid; warehouse uuid; item uuid; vid uuid; vtype text; step text:='registration'; aid uuid; foreign_a uuid;
begin
 select user_id into admin_id from public.platform_admins where status='active' and role='super_admin' limit 1;
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) values(u,'authenticated','authenticated','audit-'||u||'@example.invalid',now(),'{}','{}');
 perform set_config('request.jwt.claim.sub',u::text,true);
 c:=public.register_charity('Rollback full audit',null,'أبها','عسير',null);
 select starts_at,ends_at into initial_start,initial_end from public.charity_subscriptions where charity_id=c;
 if initial_start<>now() or initial_end<>initial_start+make_interval(days=>private.default_trial_days()) then raise exception 'trial_window_wrong'; end if;
 insert into audit_results values('Registration + immediate trial','PASS',null);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform public.platform_set_charity_status(c,'approved');
 if exists(select 1 from public.charity_subscriptions where charity_id=c and (starts_at<>initial_start or ends_at<>initial_end)) then raise exception 'approval_reset_trial'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 if not (public.current_access_state()->>'workspace_enabled')::boolean then raise exception 'owner_access_disabled'; end if;
 insert into audit_results values('Approve preserves trial + owner access','PASS',null);
 update public.charity_subscriptions set starts_at=now()-interval '2 days',ends_at=now()-interval '1 second' where charity_id=c;
 if (public.current_access_state()->>'workspace_enabled')::boolean then raise exception 'expired_access_allowed'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform public.platform_set_subscription(c,'active',now()+interval '30 days','Rollback extension');
 perform set_config('request.jwt.claim.sub',u::text,true);
 if not (public.current_access_state()->>'workspace_enabled')::boolean then raise exception 'extension_failed'; end if;
 insert into audit_results values('Expired blocks + extension restores','PASS',null);
 data:=public.accounting_initialize();fp:=(data->>'fiscal_period_id')::uuid;
 select id into cash from public.accounting_accounts where charity_id=c and code='1100';
 select id into expense from public.accounting_accounts where charity_id=c and code='5200';
 select id into revenue from public.accounting_accounts where charity_id=c and code='4100';

 execute 'set local role authenticated';
 aid:=public.accounting_save_account(null,'TEST-EXP','Rollback account','expense',true);
 perform public.accounting_save_account(aid,'TEST-EXP','Rollback renamed','expense',false);
 execute 'reset role';
 if not exists(select 1 from public.accounting_accounts where id=aid and name_ar='Rollback renamed' and not is_active and charity_id=c) then raise exception 'account_update_failed';end if;
 begin
 perform public.accounting_save_account(aid,'CHANGED','Rollback renamed','expense',true);
 raise exception 'identity_change_allowed';
 exception when others then if sqlerrm<>'account_identity_locked' then raise;end if;end;
 select id into foreign_a from public.accounting_accounts where charity_id<>c limit 1;
 if foreign_a is not null then
 begin
 perform public.accounting_save_account(foreign_a,'TEST','Rollback foreign','expense',true);
 raise exception 'foreign_account_allowed';
 exception when others then if sqlerrm<>'account_not_found' then raise;end if;end;
 end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 begin
 perform public.accounting_save_account(null,'DENIED','Rollback denied','expense',true);
 raise exception 'platform_tenant_mutation_allowed';
 exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'set local role anon';
 begin
 perform public.accounting_save_account(null,'DENIED','Rollback anon','expense',true);
 raise exception 'anon_allowed';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 insert into audit_results values('Account create update identity lock tenant/admin/anon isolation','PASS',null);
end $$;
select * from audit_results;
rollback;
