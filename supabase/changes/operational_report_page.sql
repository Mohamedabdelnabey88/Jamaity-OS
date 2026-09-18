-- Read-only scoped detail reports. No personal names, identity numbers or free-text notes.
create or replace function public.operational_report_page(
 p_kind text,p_from timestamptz,p_to timestamptz,p_status text default null,
 p_search text default '',p_page integer default 1,p_page_size integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c uuid; result jsonb; query text:=lower(btrim(coalesce(p_search,'')));
begin
 if auth.uid() is null then raise exception 'not_authenticated';end if;
 c:=private.current_charity_id();
 if c is null or not private.has_permission('reports.view') then raise exception 'forbidden';end if;
 if p_kind is null or p_kind not in ('donations','support') then raise exception 'invalid_report_kind';end if;
 if (p_kind='donations' and not private.has_permission('donations.manage')) or
 (p_kind='support' and not (private.has_permission('support.manage') or private.has_permission('support.approve'))) then raise exception 'forbidden';end if;
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<p_from then raise exception 'invalid_period';end if;
 if p_page is null or p_page<1 or p_page>1000000 or p_page_size is null or p_page_size<1 or p_page_size>100 or length(query)>120 then raise exception 'invalid_pagination';end if;
 if p_status is not null and not (p_status=any(case when p_kind='donations' then array['pledged','pending','approved','received','rejected','cancelled'] else array['requested','pending','approved','provided','rejected','cancelled'] end)) then raise exception 'invalid_status';end if;
 with source as (
  select d.id,d.reference_no reference,d.donated_at event_at,d.donation_type type,d.status,null::text approval_status,d.amount,d.planned_quantity quantity,d.unit,null::timestamptz executed_at
  from public.donations d where p_kind='donations' and d.charity_id=c
  union all
  select s.id,s.id::text,s.created_at,s.support_type,s.status,s.approval_status,s.amount,s.quantity,null::text,s.executed_at
  from public.support_records s where p_kind='support' and s.charity_id=c
 ), filtered as materialized (
  select * from source s where s.event_at>=p_from and s.event_at<=p_to and (p_status is null or s.status=p_status)
  and (query='' or position(query in lower(s.reference))>0 or position(query in s.id::text)>0)
 ), page_rows as (
  select * from filtered order by event_at desc,id desc limit p_page_size offset ((p_page-1)::bigint*p_page_size)
 ) select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.event_at desc,r.id desc) from page_rows r),'[]'::jsonb),
  'total_rows',(select count(*) from filtered),
  'cash_amount_total',(select coalesce(sum(amount) filter(where type=case when p_kind='donations' then 'cash' else 'financial' end),0) from filtered),
  'page',p_page,'page_size',p_page_size,'kind',p_kind,'status',p_status,'search',coalesce(p_search,''),
  'period',jsonb_build_object('from',p_from,'to',p_to,'timezone','Asia/Riyadh'),
  'charity',jsonb_build_object('name',(select name_ar from public.charities where id=c)),
  'generated_at',now()
 ) into result;
 return result;
end $$;
revoke all on function public.operational_report_page(text,timestamptz,timestamptz,text,text,integer,integer) from public,anon;
grant execute on function public.operational_report_page(text,timestamptz,timestamptz,text,text,integer,integer) to authenticated;
