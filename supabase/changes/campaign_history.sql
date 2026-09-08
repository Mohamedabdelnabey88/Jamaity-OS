alter table public.charity_public_content
 add column campaign_status text not null default 'active' check (campaign_status in ('active','completed')),
 add column starts_on date,
 add column ends_on date,
 add column outcome text not null default '' check (length(outcome)<=6000),
 add constraint campaign_date_order check (ends_on is null or starts_on is null or ends_on>=starts_on);
CREATE OR REPLACE FUNCTION public.manage_public_content(p_data jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid:=private.current_charity_id(); row_id uuid;
begin
 if auth.uid() is null or c is null or not private.has_permission('onboarding.manage') then raise exception 'forbidden'; end if;
 if p_data is not null then
  if jsonb_typeof(p_data)<>'object' or length(p_data::text)>16000 then raise exception 'invalid_content'; end if;
  row_id:=nullif(p_data->>'id','')::uuid;
  if row_id is null then
   insert into public.charity_public_content(charity_id,kind,title,body,image_url,link_url,donation_type,target_amount,published,campaign_status,starts_on,ends_on,outcome) values(c,p_data->>'kind',trim(p_data->>'title'),coalesce(p_data->>'body',''),nullif(p_data->>'image_url',''),nullif(p_data->>'link_url',''),nullif(p_data->>'donation_type',''),nullif(p_data->>'target_amount','')::numeric,coalesce((p_data->>'published')::boolean,false),coalesce(nullif(p_data->>'campaign_status',''),'active'),nullif(p_data->>'starts_on','')::date,nullif(p_data->>'ends_on','')::date,coalesce(p_data->>'outcome','')) returning id into row_id;
  else
   update public.charity_public_content set kind=p_data->>'kind',title=trim(p_data->>'title'),body=coalesce(p_data->>'body',''),image_url=nullif(p_data->>'image_url',''),link_url=nullif(p_data->>'link_url',''),donation_type=nullif(p_data->>'donation_type',''),target_amount=nullif(p_data->>'target_amount','')::numeric,published=coalesce((p_data->>'published')::boolean,false),campaign_status=coalesce(nullif(p_data->>'campaign_status',''),campaign_status),starts_on=case when p_data ? 'starts_on' then nullif(p_data->>'starts_on','')::date else starts_on end,ends_on=case when p_data ? 'ends_on' then nullif(p_data->>'ends_on','')::date else ends_on end,outcome=coalesce(p_data->>'outcome',outcome),updated_at=now() where id=row_id and charity_id=c;
   if not found then raise exception 'content_not_found'; end if;
  end if;
  perform private.log_audit(c,auth.uid(),'charity.content_saved','charity_public_content',row_id,null,jsonb_build_object('published',p_data->>'published'));
 end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.charity_public_content x where charity_id=c),'[]'::jsonb);
end $function$
;
CREATE OR REPLACE FUNCTION public.public_charity_site(p_charity_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('charity',jsonb_build_object('id',c.id,'charity_code',c.charity_code,'name_ar',c.name_ar,'city',c.city,'region',c.region,'description_ar',c.description_ar,'logo_url',c.logo_url),'site',to_jsonb(s)-'charity_id','updates',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'title',u.title_ar,'body',u.body_ar,'image_url',u.image_url,'published_at',u.published_at) order by u.published_at desc) from (select * from public.charity_updates where charity_id=c.id and status='published' order by published_at desc limit 30)u),'[]'::jsonb),'content',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'title',x.title,'body',x.body,'image_url',x.image_url,'link_url',x.link_url,'donation_type',x.donation_type,'target_amount',x.target_amount,'campaign_status',x.campaign_status,'starts_on',x.starts_on,'ends_on',x.ends_on,'outcome',x.outcome,'created_at',x.created_at) order by x.created_at desc) from public.charity_public_content x where x.charity_id=c.id and x.published),'[]'::jsonb))
 from public.charities c join public.charity_public_sites s on s.charity_id=c.id where c.id=p_charity_id and c.status='approved' and s.published and exists(select 1 from public.charity_subscriptions t where t.charity_id=c.id and t.status in('trial','active') and t.starts_at<=now() and (t.ends_at is null or t.ends_at>now()));
$function$
;

