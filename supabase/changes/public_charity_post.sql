-- Intentional anonymous read endpoint: published posts of an available charity only.
create or replace function public.public_charity_post(p_charity_id uuid,p_post_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',u.id,'title',u.title_ar,'body',u.body_ar,'image_url',u.image_url,'published_at',u.published_at)
 from public.charity_updates u join public.charities c on c.id=u.charity_id join public.charity_public_sites s on s.charity_id=c.id
 where u.id=p_post_id and u.charity_id=p_charity_id and u.status='published' and c.status='approved' and s.published
 and exists(select 1 from public.charity_subscriptions t where t.charity_id=c.id and t.status in('trial','active') and t.starts_at<=now() and (t.ends_at is null or t.ends_at>now()));
$$;
revoke all on function public.public_charity_post(uuid,uuid) from public;
grant execute on function public.public_charity_post(uuid,uuid) to anon,authenticated;
