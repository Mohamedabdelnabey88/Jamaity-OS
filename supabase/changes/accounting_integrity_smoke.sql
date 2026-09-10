begin;
create temp table audit_results(test text,status text,detail text);
do $$
declare u uuid:=gen_random_uuid(); admin_id uuid; c uuid; initial_start timestamptz; initial_end timestamptz; data jsonb; fp uuid; cash uuid; expense uuid; revenue uuid; journal uuid; budget uuid; donor uuid; donation uuid; warehouse uuid; item uuid; vid uuid; vtype text; step text:='registration';
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
 begin
 data:=public.accounting_post_journal('Rollback journal',jsonb_build_array(jsonb_build_object('account_id',cash,'debit',150),jsonb_build_object('account_id',revenue,'credit',150)));journal:=(data->>'id')::uuid;
 if (select sum(debit-credit) from public.journal_lines where journal_entry_id=journal)<>0 then raise exception 'unbalanced';end if;
 perform public.accounting_reverse_journal(journal,'Rollback reverse');
 insert into audit_results values('Balanced journal + reversal','PASS',null);
 exception when others then insert into audit_results values('Balanced journal + reversal','FAIL',sqlerrm);end;
 begin
 perform public.accounting_post_journal('Bad balance',jsonb_build_array(jsonb_build_object('account_id',cash,'debit',150),jsonb_build_object('account_id',revenue,'credit',140)));
 insert into audit_results values('Reject unbalanced journal','FAIL','accepted');
 exception when others then insert into audit_results values('Reject unbalanced journal',case when sqlerrm='journal_not_balanced' then 'PASS' else 'FAIL' end,sqlerrm);end;
 foreach vtype in array array['receipt','payment','expense','purchase'] loop
 begin
 data:=public.accounting_create_voucher(vtype,current_date,50,'Rollback party','Rollback voucher',expense,cash);vid:=(data->>'id')::uuid;
 perform public.accounting_void_voucher(vid,'Rollback void');
 if not exists(select 1 from public.accounting_vouchers v join public.journal_entries j on j.id=v.journal_entry_id join public.journal_entries r on r.id=v.reversal_journal_id where v.id=vid and j.reference_id=v.id and r.reversal_of_id=j.id and v.status='void') then raise exception 'voucher_links_broken'; end if;
 if (select sum(l.debit-l.credit) from public.journal_lines l where l.journal_entry_id in(select journal_entry_id from public.accounting_vouchers where id=vid union all select reversal_journal_id from public.accounting_vouchers where id=vid))<>0 then raise exception 'voucher_reversal_unbalanced';end if;
 perform public.accounting_void_voucher(vid,'Repeated void must be idempotent');
 insert into audit_results values('Voucher create + void: '||vtype,'PASS',null);
 exception when others then insert into audit_results values('Voucher create + void: '||vtype,'FAIL',sqlerrm);end;end loop;
 begin
 budget:=public.accounting_budget_create(fp,'Rollback budget',jsonb_build_array(jsonb_build_object('account_id',expense,'amount',1000)));
 perform public.accounting_budget_approve(budget);perform public.accounting_budget_vs_actual(budget);
 perform public.accounting_post_journal('Current expense',jsonb_build_array(jsonb_build_object('account_id',expense,'debit',75),jsonb_build_object('account_id',cash,'credit',75)));
 perform public.accounting_create_period('Next audit year',(date_trunc('year',current_date)+interval '1 year')::date,(date_trunc('year',current_date)+interval '2 years - 1 day')::date);
 perform public.accounting_post_journal('Outside budget period',jsonb_build_array(jsonb_build_object('account_id',expense,'debit',200),jsonb_build_object('account_id',cash,'credit',200)),(date_trunc('year',current_date)+interval '1 year')::date);
 data:=public.accounting_budget_vs_actual(budget);
 if (data->0->>'actual_amount')::numeric<>75 or (data->0->>'variance')::numeric<>925 then raise exception 'budget_period_totals_wrong: %',data;end if;
 insert into audit_results values('Budget create approve actual','PASS',null);
 exception when others then insert into audit_results values('Budget create approve actual','FAIL',sqlerrm);end;
 begin
 donor:=(public.create_donor('Rollback donor',null,null,'individual')->>'id')::uuid;
 donation:=public.create_donation_v2(donor,'cash',200);
 perform public.approve_donation(donation);perform public.receive_donation(donation);
 if not exists(select 1 from public.journal_entries where charity_id=c and reference_id=donation and reference_type='donation') then raise exception 'cash_journal_missing';end if;
 insert into audit_results values('Donor + cash donation ledger','PASS',null);
 exception when others then insert into audit_results values('Donor + cash donation ledger','FAIL',sqlerrm);end;
 begin
 warehouse:=public.create_warehouse('Rollback warehouse');item:=public.create_inventory_item('AUDIT','Rollback basket');
 donation:=public.create_donation_v2(donor,'in_kind',100,null,now(),'food baskets',5,'basket');
 perform public.approve_donation(donation);perform public.receive_in_kind_donation(donation,warehouse,item,5);perform public.inventory_balances();
 if not exists(select 1 from public.stock_movements where reference_id=donation and quantity=5) then raise exception 'stock_missing';end if;
 insert into audit_results values('In-kind donation + inventory','PASS',null);
 exception when others then insert into audit_results values('In-kind donation + inventory','FAIL',sqlerrm);end;
 begin
 perform public.accounting_trial_balance();perform public.accounting_income_statement();perform public.accounting_balance_sheet();perform public.accounting_fund_report();perform public.monthly_management_report();
 insert into audit_results values('Financial/report RPC execution','PASS',null);
 exception when others then insert into audit_results values('Financial/report RPC execution','FAIL',sqlerrm);end;
 begin
 perform public.governance_center();perform public.configure_default_approval_policies();perform public.approval_inbox();perform public.attention_center();perform public.onboarding_state();perform public.dashboard_operational_summary();
 insert into audit_results values('Governance approval attention onboarding dashboard','PASS',null);
 exception when others then insert into audit_results values('Governance approval attention onboarding dashboard','FAIL',sqlerrm);end;
 perform public.accounting_close_period(fp);
 begin
 perform public.accounting_post_journal('Closed period',jsonb_build_array(jsonb_build_object('account_id',cash,'debit',150),jsonb_build_object('account_id',revenue,'credit',150)));
 insert into audit_results values('Closed period rejects posting','FAIL','accepted');
 exception when others then insert into audit_results values('Closed period rejects posting',case when sqlerrm like '%closed%' or sqlerrm like '%locked%' then 'PASS' else 'FAIL' end,sqlerrm);end;
exception when others then insert into audit_results values('Core fixture / lifecycle','FAIL',sqlerrm);
end $$;
select * from audit_results;
do $$ begin if exists(select 1 from audit_results where status='FAIL') then raise exception 'Accounting regression failed';end if;end $$;
rollback;

