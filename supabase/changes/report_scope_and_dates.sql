-- Account entry_date is a Saudi civil date, not the database session date.
do $$
declare fn regprocedure; original text; revised text;
begin
 foreach fn in array array['public.accounting_income_statement(timestamptz,timestamptz)'::regprocedure,'public.accounting_trial_balance(timestamptz,timestamptz)'::regprocedure] loop
  original:=pg_get_functiondef(fn);
  revised:=replace(replace(original,'p_from::date', '(p_from at time zone ''Asia/Riyadh'')::date'),'p_to::date','(p_to at time zone ''Asia/Riyadh'')::date');
  if original=revised then raise exception 'unexpected_function_definition: %',fn; end if;
  execute revised;
 end loop;
end $$;

create or replace function public.monthly_management_report(
 p_from timestamptz default date_trunc('month',now()),p_to timestamptz default now()
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c uuid; operational jsonb; financial jsonb; governance jsonb; trial jsonb; inventory jsonb;
 cases_created int; support_executed int; donations_received int; can_dashboard boolean; can_governance boolean; can_inventory boolean; can_cases boolean; can_support boolean; can_donations boolean;
begin
 if auth.uid() is null then raise exception 'not_authenticated';end if;
 c:=private.current_charity_id();
 if c is null or not private.has_permission('reports.view') then raise exception 'forbidden';end if;
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<p_from then raise exception 'invalid_period';end if;
 can_dashboard:=private.has_permission('dashboard.view');
 can_governance:=private.has_permission('governance.view') or private.has_permission('governance.manage');
 can_inventory:=private.has_permission('inventory.manage');
 can_cases:=private.has_permission('cases.view') or private.has_permission('cases.manage');
 can_support:=private.has_permission('support.manage') or private.has_permission('support.approve');
 can_donations:=private.has_permission('donations.manage');
 if can_dashboard then operational:=public.dashboard_operational_summary();end if;
 financial:=public.accounting_income_statement(p_from,p_to);
 select coalesce(jsonb_agg(to_jsonb(t) order by t.code),'[]'::jsonb) into trial from public.accounting_trial_balance(p_from,p_to) t;
 if can_governance then
  governance:=public.governance_center();
  governance:=jsonb_build_object('score',governance->'score','ready',governance->'ready','total',governance->'total','overdue',governance->'overdue');
 end if;
 if can_inventory then select coalesce(jsonb_agg(to_jsonb(i) order by i.warehouse_name,i.item_name),'[]'::jsonb) into inventory from public.inventory_balances() i;end if;
 if can_cases then select count(*) into cases_created from public.cases where charity_id=c and created_at>=p_from and created_at<=p_to;end if;
 if can_support then select count(*) into support_executed from public.support_records where charity_id=c and approval_status='executed' and executed_at>=p_from and executed_at<=p_to;end if;
 if can_donations then select count(*) into donations_received from public.donations where charity_id=c and status='received' and donated_at>=p_from and donated_at<=p_to;end if;
 return jsonb_build_object(
  'period',jsonb_build_object('from',p_from,'to',p_to,'timezone','Asia/Riyadh'),
  'charity',jsonb_build_object('name',(select name_ar from public.charities where id=c)),
  'operational',operational,'financial',financial,'governance',governance,
  'period_activity',jsonb_build_object('cases_created',cases_created,'support_executed',support_executed,'donations_received',donations_received),
  'trial_balance',trial,'inventory_balances',inventory,'generated_at',now(),
  'scope',jsonb_build_object('operational',can_dashboard,'governance',can_governance,'inventory',can_inventory,'cases',can_cases,'support',can_support,'donations',can_donations)
 );
end $$;
revoke all on function public.monthly_management_report(timestamptz,timestamptz) from public,anon;
grant execute on function public.monthly_management_report(timestamptz,timestamptz) to authenticated;
