-- Preserve posted-entry immutability: allocate the voucher reference before posting.
CREATE OR REPLACE FUNCTION public.accounting_create_voucher(p_voucher_type text, p_transaction_date date, p_amount numeric, p_party_name text, p_description text, p_debit_account_id uuid, p_credit_account_id uuid, p_payment_method text DEFAULT 'bank'::text, p_external_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid:=private.current_charity_id(); v public.accounting_vouchers%rowtype; je uuid; voucher_id uuid:=gen_random_uuid(); prefix text; seq bigint;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('accounting.manage') then raise exception 'forbidden'; end if;
 if p_voucher_type not in('receipt','payment','expense','purchase') then raise exception 'invalid_voucher_type'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'amount_must_be_positive'; end if;
 if nullif(trim(p_description),'') is null then raise exception 'description_required'; end if;
 if p_payment_method not in('cash','bank','transfer','credit') then raise exception 'invalid_payment_method'; end if;
 if p_debit_account_id=p_credit_account_id then raise exception 'accounts_must_differ'; end if;
 if not exists(select 1 from public.accounting_accounts where id=p_debit_account_id and charity_id=c and is_active) or
    not exists(select 1 from public.accounting_accounts where id=p_credit_account_id and charity_id=c and is_active) then raise exception 'account_not_found'; end if;
 perform private.assert_accounting_period_open(c,coalesce(p_transaction_date,current_date));
 perform pg_advisory_xact_lock(hashtextextended(c::text||':'||p_voucher_type,0));
 prefix:=case p_voucher_type when 'receipt' then 'RV' when 'payment' then 'PV' when 'expense' then 'EX' else 'PO' end;
 select count(*)+1 into seq from public.accounting_vouchers where charity_id=c and voucher_type=p_voucher_type;
 insert into public.journal_entries(charity_id,reference_type,reference_id,description,status,created_by,entry_date,posted_at)
 values(c,'accounting_voucher',voucher_id,trim(p_description),'posted',auth.uid(),coalesce(p_transaction_date,current_date),now()) returning id into je;
 insert into public.journal_lines(journal_entry_id,account_id,debit,credit,description) values
 (je,p_debit_account_id,p_amount,0,trim(p_description)),(je,p_credit_account_id,0,p_amount,trim(p_description));
 insert into public.accounting_vouchers(id,charity_id,voucher_no,voucher_type,transaction_date,amount,party_name,description,payment_method,external_reference,debit_account_id,credit_account_id,journal_entry_id,created_by)
 values(voucher_id,c,prefix||'-'||to_char(coalesce(p_transaction_date,current_date),'YYYYMMDD')||'-'||lpad(seq::text,4,'0'),p_voucher_type,coalesce(p_transaction_date,current_date),p_amount,
 nullif(trim(coalesce(p_party_name,'')),''),trim(p_description),p_payment_method,nullif(trim(coalesce(p_external_reference,'')),''),p_debit_account_id,p_credit_account_id,je,auth.uid()) returning * into v;
 perform private.log_audit(c,auth.uid(),'accounting.voucher_posted','accounting_voucher',v.id,null,to_jsonb(v));
 return jsonb_build_object('id',v.id,'voucher_no',v.voucher_no,'journal_entry_id',je,'status','posted');
end $function$;

CREATE OR REPLACE FUNCTION public.accounting_void_voucher(p_voucher_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid:=private.current_charity_id(); v public.accounting_vouchers%rowtype; reversed jsonb; rid uuid;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('accounting.manage') then raise exception 'forbidden'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;
 select * into v from public.accounting_vouchers where id=p_voucher_id and charity_id=c for update;
 if not found then raise exception 'voucher_not_found'; end if;
 if v.status='void' then return jsonb_build_object('id',v.id,'status','void','duplicate',true); end if;
 reversed:=public.accounting_reverse_journal(v.journal_entry_id,trim(p_reason));
 rid:=(reversed->>'reversal_id')::uuid;
 update public.accounting_vouchers set status='void',reversal_journal_id=rid,voided_by=auth.uid(),voided_at=now() where id=v.id;
 perform private.log_audit(c,auth.uid(),'accounting.voucher_voided','accounting_voucher',v.id,to_jsonb(v),jsonb_build_object('reason',p_reason,'reversal_journal_id',rid));
 return jsonb_build_object('id',v.id,'status','void','reversal_journal_id',rid,'duplicate',false);
end $function$;

-- Only posted entries inside the selected fiscal period contribute to actuals.
CREATE OR REPLACE FUNCTION public.accounting_budget_vs_actual(p_budget_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid:=private.current_charity_id(); r jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not (private.has_permission('accounting.view') or private.has_permission('accounting.manage') or private.has_permission('reports.view')) then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.accounting_budgets where id=p_budget_id and charity_id=c) then raise exception 'budget_not_found'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.account_code),'[]'::jsonb) into r from (
  select bl.id line_id,a.code account_code,a.name_ar,a.account_type,bl.amount budget_amount,
   coalesce(sum(case when je.id is null then 0 when a.account_type='revenue' then jl.credit-jl.debit else jl.debit-jl.credit end),0)::numeric actual_amount,
   (bl.amount-coalesce(sum(case when je.id is null then 0 when a.account_type='revenue' then jl.credit-jl.debit else jl.debit-jl.credit end),0))::numeric variance
  from public.accounting_budget_lines bl join public.accounting_budgets b on b.id=bl.budget_id join public.accounting_fiscal_periods fp on fp.id=b.fiscal_period_id join public.accounting_accounts a on a.id=bl.account_id
  left join public.journal_lines jl on jl.account_id=bl.account_id and (bl.cost_center_id is null or jl.cost_center_id=bl.cost_center_id) and (bl.fund_id is null or jl.fund_id=bl.fund_id)
  left join public.journal_entries je on je.id=jl.journal_entry_id and je.charity_id=c and je.status='posted' and je.entry_date between fp.starts_on and fp.ends_on
  where b.id=p_budget_id and b.charity_id=c group by bl.id,a.code,a.name_ar,a.account_type,bl.amount
 ) x;
 return r;
end $function$;

