-- Applied to Supabase project: yagbmbuevtjaqypkujaf
-- This repository predates a Supabase CLI migration history. Keep this patch
-- as the audited source of the production corrections until db pull is adopted.

create or replace function private.hash_national_id(p_national_id text)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare s bytea; n text;
begin
  n:=regexp_replace(coalesce(p_national_id,''),'[^0-9]','','g');
  if length(n)<8 or length(n)>20 then raise exception 'invalid_national_id'; end if;
  select secret into s from private.app_secrets where key='national_id_pepper';
  if s is null then raise exception 'national_id_pepper_missing'; end if;
  return encode(extensions.hmac(convert_to(n,'UTF8'),s,'sha256'),'hex');
end
$$;

create or replace function public.accounting_budgets()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare c uuid:=private.current_charity_id(); r jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if c is null or not (
    private.has_permission('accounting.view')
    or private.has_permission('accounting.manage')
    or private.has_permission('reports.view')
  ) then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into r
  from (
    select b.id,b.name,b.status,b.fiscal_period_id,p.name period_name,p.starts_on,p.ends_on,
      b.approved_at,b.created_at,
      coalesce((select sum(bl.amount) from public.accounting_budget_lines bl where bl.budget_id=b.id),0) total_amount,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',bl.id,'account_id',bl.account_id,'account_code',a.code,'account_name',a.name_ar,
          'cost_center_id',bl.cost_center_id,'fund_id',bl.fund_id,'amount',bl.amount,'note',bl.note
        ) order by a.code)
        from public.accounting_budget_lines bl
        join public.accounting_accounts a on a.id=bl.account_id
        where bl.budget_id=b.id
      ),'[]'::jsonb) lines
    from public.accounting_budgets b
    join public.accounting_fiscal_periods p on p.id=b.fiscal_period_id
    where b.charity_id=c
  ) x;
  return r;
end
$$;

revoke all on function public.accounting_budgets() from public,anon;
grant execute on function public.accounting_budgets() to authenticated;

create index if not exists platform_settings_updated_by_idx
  on public.platform_settings(updated_by);
