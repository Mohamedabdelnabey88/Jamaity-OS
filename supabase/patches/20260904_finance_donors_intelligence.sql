alter table public.donations add column if not exists in_kind_description text;
alter table public.donations add column if not exists planned_quantity numeric;
alter table public.donations add column if not exists unit text;

create or replace function public.create_donor(p_full_name text,p_phone text default null,p_email text default null,p_donor_type text default 'individual')
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); d public.donors%rowtype;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('donors.manage') then raise exception 'forbidden'; end if;
 if nullif(trim(p_full_name),'') is null then raise exception 'donor_name_required'; end if;
 if p_donor_type not in('individual','company','foundation') then raise exception 'invalid_donor_type'; end if;
 insert into public.donors(charity_id,full_name,phone,email,donor_type)
 values(c,trim(p_full_name),nullif(trim(coalesce(p_phone,'')),''),nullif(lower(trim(coalesce(p_email,''))),''),p_donor_type)
 returning * into d;
 perform private.log_audit(c,auth.uid(),'donor.created','donor',d.id,null,to_jsonb(d));
 return jsonb_build_object('id',d.id,'full_name',d.full_name,'status','created');
exception when unique_violation then raise exception 'donor_email_already_exists';
end $$;

create or replace function public.create_donation(p_donor_id uuid,p_donation_type text,p_amount numeric,p_reference_no text default null,p_donated_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); did uuid; ref text;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('donations.manage') then raise exception 'forbidden'; end if;
 if p_donation_type not in('cash','in_kind') then raise exception 'invalid_donation_type'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'amount_must_be_positive'; end if;
 if not exists(select 1 from public.donors where id=p_donor_id and charity_id=c) then raise exception 'donor_not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text||':donation',0));
 ref:=nullif(trim(coalesce(p_reference_no,'')),'');
 if ref is null then
  ref:='DON-'||to_char(coalesce(p_donated_at,now()),'YYYYMMDD')||'-'||lpad((1+count(*))::text,4,'0') from public.donations where charity_id=c;
 end if;
 insert into public.donations(charity_id,donor_id,donation_type,amount,reference_no,status,donated_at)
 values(c,p_donor_id,p_donation_type,p_amount,ref,'pending',coalesce(p_donated_at,now())) returning id into did;
 perform private.log_audit(c,auth.uid(),'donation.created','donation',did,null,jsonb_build_object('donation_type',p_donation_type,'amount',p_amount,'reference_no',ref));
 return did;
exception when unique_violation then raise exception 'donation_reference_already_exists';
end $$;

create or replace function public.create_donation_v2(
 p_donor_id uuid,p_donation_type text,p_amount numeric,p_reference_no text default null,p_donated_at timestamptz default now(),
 p_in_kind_description text default null,p_planned_quantity numeric default null,p_unit text default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare did uuid;
begin
 if p_donation_type='in_kind' and nullif(trim(coalesce(p_in_kind_description,'')),'') is null then raise exception 'in_kind_description_required'; end if;
 if p_donation_type='in_kind' and coalesce(p_planned_quantity,0)<=0 then raise exception 'quantity_must_be_positive'; end if;
 did:=public.create_donation(p_donor_id,p_donation_type,p_amount,p_reference_no,p_donated_at);
 update public.donations set in_kind_description=nullif(trim(coalesce(p_in_kind_description,'')),''),planned_quantity=p_planned_quantity,unit=nullif(trim(coalesce(p_unit,'')),'') where id=did;
 return did;
end $$;

create table if not exists public.accounting_vouchers (
 id uuid primary key default gen_random_uuid(),
 charity_id uuid not null references public.charities(id) on delete cascade,
 voucher_no text not null,
 voucher_type text not null check(voucher_type in('receipt','payment','expense','purchase')),
 transaction_date date not null default current_date,
 amount numeric(18,2) not null check(amount>0),
 party_name text,
 description text not null,
 payment_method text not null default 'bank' check(payment_method in('cash','bank','transfer','credit')),
 external_reference text,
 debit_account_id uuid not null references public.accounting_accounts(id) on delete restrict,
 credit_account_id uuid not null references public.accounting_accounts(id) on delete restrict,
 journal_entry_id uuid unique references public.journal_entries(id) on delete restrict,
 reversal_journal_id uuid unique references public.journal_entries(id) on delete restrict,
 status text not null default 'posted' check(status in('posted','void')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 voided_by uuid references auth.users(id) on delete set null,
 voided_at timestamptz,
 unique(charity_id,voucher_no)
);
create index if not exists accounting_vouchers_charity_date_idx on public.accounting_vouchers(charity_id,transaction_date desc,created_at desc);
create index if not exists accounting_vouchers_charity_type_idx on public.accounting_vouchers(charity_id,voucher_type,status);
create index if not exists accounting_vouchers_debit_idx on public.accounting_vouchers(debit_account_id);
create index if not exists accounting_vouchers_credit_idx on public.accounting_vouchers(credit_account_id);
create index if not exists accounting_vouchers_created_by_idx on public.accounting_vouchers(created_by);
create index if not exists accounting_vouchers_voided_by_idx on public.accounting_vouchers(voided_by);
alter table public.accounting_vouchers enable row level security;
revoke all on public.accounting_vouchers from public,anon,authenticated;

create or replace function public.accounting_create_voucher(
 p_voucher_type text,p_transaction_date date,p_amount numeric,p_party_name text,p_description text,
 p_debit_account_id uuid,p_credit_account_id uuid,p_payment_method text default 'bank',p_external_reference text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); v public.accounting_vouchers%rowtype; je uuid; prefix text; seq bigint;
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
 insert into public.journal_entries(charity_id,reference_type,description,status,created_by,entry_date,posted_at)
 values(c,'accounting_voucher',trim(p_description),'posted',auth.uid(),coalesce(p_transaction_date,current_date),now()) returning id into je;
 insert into public.journal_lines(journal_entry_id,account_id,debit,credit,description) values
 (je,p_debit_account_id,p_amount,0,trim(p_description)),(je,p_credit_account_id,0,p_amount,trim(p_description));
 insert into public.accounting_vouchers(charity_id,voucher_no,voucher_type,transaction_date,amount,party_name,description,payment_method,external_reference,debit_account_id,credit_account_id,journal_entry_id,created_by)
 values(c,prefix||'-'||to_char(coalesce(p_transaction_date,current_date),'YYYYMMDD')||'-'||lpad(seq::text,4,'0'),p_voucher_type,coalesce(p_transaction_date,current_date),p_amount,
 nullif(trim(coalesce(p_party_name,'')),''),trim(p_description),p_payment_method,nullif(trim(coalesce(p_external_reference,'')),''),p_debit_account_id,p_credit_account_id,je,auth.uid()) returning * into v;
 update public.journal_entries set reference_id=v.id where id=je;
 perform private.log_audit(c,auth.uid(),'accounting.voucher_posted','accounting_voucher',v.id,null,to_jsonb(v));
 return jsonb_build_object('id',v.id,'voucher_no',v.voucher_no,'journal_entry_id',je,'status','posted');
end $$;

create or replace function public.accounting_vouchers(p_type text default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not (private.has_permission('accounting.view') or private.has_permission('accounting.manage') or private.has_permission('reports.view')) then raise exception 'forbidden'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.transaction_date desc,x.created_at desc),'[]'::jsonb) into result from (
  select v.id,v.voucher_no,v.voucher_type,v.transaction_date,v.amount,v.party_name,v.description,v.payment_method,v.external_reference,v.status,v.created_at,
  da.code debit_code,da.name_ar debit_account,ca.code credit_code,ca.name_ar credit_account,v.journal_entry_id,v.reversal_journal_id
  from public.accounting_vouchers v join public.accounting_accounts da on da.id=v.debit_account_id join public.accounting_accounts ca on ca.id=v.credit_account_id
  where v.charity_id=c and (p_type is null or v.voucher_type=p_type) limit 500
 ) x;
 return result;
end $$;

create or replace function public.accounting_void_voucher(p_voucher_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); v public.accounting_vouchers%rowtype; reversed jsonb; rid uuid;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('accounting.manage') then raise exception 'forbidden'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;
 select * into v from public.accounting_vouchers where id=p_voucher_id and charity_id=c for update;
 if not found then raise exception 'voucher_not_found'; end if;
 if v.status='void' then return jsonb_build_object('id',v.id,'status','void','duplicate',true); end if;
 reversed:=public.accounting_reverse_journal(v.journal_entry_id,trim(p_reason));
 rid:=(reversed->>'id')::uuid;
 update public.accounting_vouchers set status='void',reversal_journal_id=rid,voided_by=auth.uid(),voided_at=now() where id=v.id;
 perform private.log_audit(c,auth.uid(),'accounting.voucher_voided','accounting_voucher',v.id,to_jsonb(v),jsonb_build_object('reason',p_reason,'reversal_journal_id',rid));
 return jsonb_build_object('id',v.id,'status','void','reversal_journal_id',rid,'duplicate',false);
end $$;

create or replace function public.charity_profile()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null then raise exception 'forbidden'; end if;
 select to_jsonb(x) into result from (select id,name_ar,name_en,slug,city,region,description_ar,logo_url,status,verified_at,created_at from public.charities where id=c) x;
 return result;
end $$;

create or replace function public.update_charity_profile(p_name_ar text,p_name_en text,p_city text,p_region text,p_description_ar text,p_logo_url text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); old_row public.charities%rowtype; new_row public.charities%rowtype;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('onboarding.manage') then raise exception 'forbidden'; end if;
 if nullif(trim(p_name_ar),'') is null or nullif(trim(p_city),'') is null or nullif(trim(p_region),'') is null then raise exception 'required_fields_missing'; end if;
 select * into old_row from public.charities where id=c for update;
 update public.charities set name_ar=trim(p_name_ar),name_en=nullif(trim(coalesce(p_name_en,'')),''),city=trim(p_city),region=trim(p_region),description_ar=nullif(trim(coalesce(p_description_ar,'')),''),logo_url=nullif(trim(coalesce(p_logo_url,'')),''),updated_at=now() where id=c returning * into new_row;
 perform private.log_audit(c,auth.uid(),'charity.profile_updated','charity',c,to_jsonb(old_row),to_jsonb(new_row));
 return to_jsonb(new_row)-'description_en';
end $$;

create or replace function public.workspace_smart_insights(p_page text default 'dashboard')
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); items jsonb:='[]'::jsonb; n bigint; amount numeric;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null then raise exception 'forbidden'; end if;
 select count(*) into n from public.beneficiary_applications where charity_id=c and status in('submitted','under_review');
 if n>0 then items:=items||jsonb_build_array(jsonb_build_object('severity','high','title','طلبات مستفيدين تنتظر القرار','body',n||' طلب يحتاج مراجعة المستندات والبيانات.','action_path','/beneficiary-applications')); end if;
 if p_page in('dashboard','donors','donations') then
  select count(*) into n from public.donors where charity_id=c and phone is null and email is null;
  if n>0 then items:=items||jsonb_build_array(jsonb_build_object('severity','medium','title','بيانات تواصل غير مكتملة','body',n||' متبرع بلا جوال أو بريد؛ استكمالها يحسن المتابعة.','action_path','/donors')); end if;
  select count(*),coalesce(sum(amount),0) into n,amount from public.donations where charity_id=c and status in('pending','approved');
  if n>0 then items:=items||jsonb_build_array(jsonb_build_object('severity','high','title','تبرعات قبل الاستلام','body',n||' تبرعًا بقيمة تقديرية '||amount||' ر.س يحتاج إتمام الإجراء.','action_path','/donations')); end if;
 end if;
 if p_page in('dashboard','accounting') then
  select count(*) into n from public.accounting_fiscal_periods where charity_id=c and status='open' and current_date between starts_on and ends_on;
  if n=0 then items:=items||jsonb_build_array(jsonb_build_object('severity','high','title','لا توجد فترة مالية مفتوحة','body','أنشئ أو افتح فترة تغطي تاريخ اليوم قبل ترحيل السندات.','action_path','/accounting/periods')); end if;
  select count(*) into n from public.accounting_vouchers where charity_id=c and status='posted' and transaction_date>=date_trunc('month',current_date)::date;
  if n=0 then items:=items||jsonb_build_array(jsonb_build_object('severity','low','title','لا توجد مستندات مالية هذا الشهر','body','راجع سندات القبض والصرف والمصروفات والمشتريات لضمان اكتمال التسجيل.','action_path','/accounting/vouchers')); end if;
 end if;
 if p_page in('dashboard','inventory','donations') then
  select count(*) into n from public.inventory_balances() where on_hand<=0;
  if n>0 then items:=items||jsonb_build_array(jsonb_build_object('severity','medium','title','أرصدة مخزون تحتاج انتباهًا','body',n||' رصيد مستودعي يساوي صفرًا أو أقل.','action_path','/inventory')); end if;
 end if;
 return jsonb_build_object('page',p_page,'mode','data_driven','items',items,'generated_at',now());
end $$;

revoke all on function public.create_donor(text,text,text,text) from public,anon;
revoke all on function public.create_donation_v2(uuid,text,numeric,text,timestamptz,text,numeric,text) from public,anon;
revoke all on function public.accounting_create_voucher(text,date,numeric,text,text,uuid,uuid,text,text) from public,anon;
revoke all on function public.accounting_vouchers(text) from public,anon;
revoke all on function public.accounting_void_voucher(uuid,text) from public,anon;
revoke all on function public.charity_profile() from public,anon;
revoke all on function public.update_charity_profile(text,text,text,text,text,text) from public,anon;
revoke all on function public.workspace_smart_insights(text) from public,anon;
grant execute on function public.create_donor(text,text,text,text) to authenticated;
grant execute on function public.create_donation_v2(uuid,text,numeric,text,timestamptz,text,numeric,text) to authenticated;
grant execute on function public.accounting_create_voucher(text,date,numeric,text,text,uuid,uuid,text,text) to authenticated;
grant execute on function public.accounting_vouchers(text) to authenticated;
grant execute on function public.accounting_void_voucher(uuid,text) to authenticated;
grant execute on function public.charity_profile() to authenticated;
grant execute on function public.update_charity_profile(text,text,text,text,text,text) to authenticated;
grant execute on function public.workspace_smart_insights(text) to authenticated;
