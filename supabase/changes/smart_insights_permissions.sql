create or replace function public.workspace_smart_insights(p_page text default 'dashboard') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c uuid:=private.current_charity_id(); items jsonb:='[]'::jsonb; n bigint; donation_amount numeric;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null then raise exception 'forbidden'; end if;
 if private.has_permission('beneficiaries.view') or private.has_permission('beneficiaries.manage') then
  select count(*) into n from public.beneficiary_applications ba where ba.charity_id=c and ba.status in('submitted','under_review');
  if n>0 then items:=items||jsonb_build_array(jsonb_build_object('severity','high','title','طلبات مستفيدين تنتظر القرار','body',n||' طلب يحتاج مراجعة المستندات والبيانات.','action_path','/beneficiary-applications')); end if;
 end if;
 if p_page in('dashboard','donors','donations') and (private.has_permission('donors.view') or private.has_permission('donors.manage')) then
  select count(*) into n from public.donors d where d.charity_id=c and d.phone is null and d.email is null;
  if n>0 then items:=items||jsonb_build_array(jsonb_build_object('severity','medium','title','بيانات تواصل غير مكتملة','body',n||' متبرع بلا جوال أو بريد؛ استكمالها يحسن المتابعة.','action_path','/donors')); end if;
 end if;
 if p_page in('dashboard','donors','donations') and private.has_permission('donations.manage') then
  select count(*),coalesce(sum(d.amount),0) into n,donation_amount from public.donations d where d.charity_id=c and d.status in('pending','approved');
  if n>0 then items:=items||jsonb_build_array(jsonb_build_object('severity','high','title','تبرعات قبل الاستلام','body',n||' تبرعًا بقيمة تقديرية '||donation_amount||' ر.س يحتاج إتمام الإجراء.','action_path','/donations')); end if;
 end if;
 if p_page in('dashboard','accounting') and (private.has_permission('accounting.view') or private.has_permission('accounting.manage') or private.has_permission('audit.view')) then
  select count(*) into n from public.accounting_fiscal_periods f where f.charity_id=c and f.status='open' and current_date between f.starts_on and f.ends_on;
  if n=0 then items:=items||jsonb_build_array(jsonb_build_object('severity','high','title','لا توجد فترة مالية مفتوحة','body','أنشئ أو افتح فترة تغطي تاريخ اليوم قبل ترحيل السندات.','action_path','/accounting/periods')); end if;
  select count(*) into n from public.accounting_vouchers v where v.charity_id=c and v.status='posted' and v.transaction_date>=date_trunc('month',current_date)::date;
  if n=0 then items:=items||jsonb_build_array(jsonb_build_object('severity','low','title','لا توجد مستندات مالية هذا الشهر','body','راجع سندات القبض والصرف والمصروفات والمشتريات لضمان اكتمال التسجيل.','action_path','/accounting/vouchers')); end if;
 end if;
 if p_page in('dashboard','inventory','donations') and private.has_permission('inventory.manage') then
  select count(*) into n from public.inventory_balances() i where i.on_hand<=0;
  if n>0 then items:=items||jsonb_build_array(jsonb_build_object('severity','medium','title','أرصدة مخزون تحتاج انتباهًا','body',n||' رصيد مستودعي يساوي صفرًا أو أقل.','action_path','/inventory')); end if;
 end if;
 return jsonb_build_object('page',p_page,'mode','data_driven','items',items,'generated_at',now());
end $$;
revoke all on function public.workspace_smart_insights(text) from public,anon;
grant execute on function public.workspace_smart_insights(text) to authenticated;
