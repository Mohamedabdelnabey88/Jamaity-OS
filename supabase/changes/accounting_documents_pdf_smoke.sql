
begin;
do $$
declare
 v_owner uuid;
 v_charity uuid;
 v_debit uuid;
 v_credit uuid;
 v_date date;
 v_created jsonb;
 v_voucher uuid;
 v_att jsonb;
 v_list jsonb;
 v_vouchers jsonb;
begin
 select cm.user_id,cm.charity_id into v_owner,v_charity
 from public.charity_members cm
 join public.roles r on r.id=cm.role_id
 where cm.status='active' and r.code='owner'
 order by cm.created_at
 limit 1;
 if v_owner is null then raise exception 'fixture_missing_owner'; end if;

 select starts_on into v_date
 from public.accounting_fiscal_periods
 where charity_id=v_charity and status='open'
 order by starts_on desc
 limit 1;
 if v_date is null then raise exception 'fixture_missing_open_period'; end if;

 select id into v_debit from public.accounting_accounts where charity_id=v_charity and is_active order by (account_type='expense') desc,code limit 1;
 select id into v_credit from public.accounting_accounts where charity_id=v_charity and is_active and id<>v_debit order by (account_type='asset') desc,code limit 1;
 if v_debit is null or v_credit is null then raise exception 'fixture_missing_accounts'; end if;

 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';

 v_created:=public.accounting_create_voucher('expense',v_date,125.50,'مورد اختبار','مصروف اختبار مستندي',v_debit,v_credit,'bank','SMOKE-DOC');
 v_voucher:=(v_created->>'id')::uuid;
 if v_voucher is null then raise exception 'voucher_create_failed'; end if;

 v_att:=public.add_accounting_voucher_attachment(
   v_voucher,'invoice','invoice-smoke.pdf',
   v_charity::text||'/vouchers/'||v_voucher::text||'/invoice-smoke.pdf',
   'application/pdf',2048
 );
 if nullif(v_att->>'id','') is null then raise exception 'attachment_create_failed'; end if;

 v_list:=public.accounting_voucher_attachments(v_voucher);
 if jsonb_array_length(v_list)<>1 then raise exception 'attachment_list_failed'; end if;

 v_vouchers:=public.accounting_vouchers('expense');
 if not exists(
   select 1 from jsonb_array_elements(v_vouchers) x
   where (x->>'id')::uuid=v_voucher and (x->>'attachment_count')::int=1
 ) then raise exception 'attachment_count_failed'; end if;

 begin
   perform public.add_accounting_voucher_attachment(
     v_voucher,'invoice','bad.pdf',
     '00000000-0000-0000-0000-000000000000/vouchers/'||v_voucher::text||'/bad.pdf',
     'application/pdf',1024
   );
   raise exception 'cross_tenant_path_allowed';
 exception when others then
   if sqlerrm='cross_tenant_path_allowed' then raise; end if;
   if sqlerrm not like '%invalid_object_path%' then raise; end if;
 end;
end $$;

select 'PASS: voucher invoice attachment is tenant-bound and visible in voucher register' as result;
rollback;
