create or replace function public.approved_charities_directory(p_region text default null,p_city text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.region,x.city,x.name_ar),'[]'::jsonb)
 from (
  select c.id,c.name_ar,c.name_en,c.slug,c.city,c.region,c.description_ar,c.logo_url
  from public.charities c
  where c.status='approved'
  and (p_region is null or trim(p_region)='' or lower(coalesce(c.region,''))=lower(trim(p_region)))
  and (p_city is null or trim(p_city)='' or lower(coalesce(c.city,''))=lower(trim(p_city)))
  and exists(select 1 from public.charity_subscriptions s where s.charity_id=c.id
   and s.status in ('trial','active') and coalesce(s.starts_at,now())<=now() and (s.ends_at is null or s.ends_at>now()))
 ) x;
$$;
revoke all on function public.approved_charities_directory(text,text) from public;
grant execute on function public.approved_charities_directory(text,text) to anon,authenticated;
