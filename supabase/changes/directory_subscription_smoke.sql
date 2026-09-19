begin;
do $$
declare u uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();c uuid;data jsonb;
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) select x,'authenticated','authenticated','directory-'||x||'@example.invalid',now(),'{}','{}' from unnest(array[u,admin_id])x;
 insert into public.platform_admins(user_id) values(admin_id);
 perform set_config('request.jwt.claim.sub',u::text,true);c:=public.register_charity('Synthetic directory charity',null,'Audit city','Audit region',null);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform public.platform_set_charity_status(c,'approved');
 execute 'set local role anon';data:=public.approved_charities_directory('Audit region','Audit city');
 if not exists(select 1 from jsonb_array_elements(data)x where x->>'id'=c::text) then raise exception 'active_missing';end if;
 execute 'reset role';
 update public.charity_subscriptions set starts_at=now()+interval '1 day',ends_at=now()+interval '15 days' where charity_id=c;
 execute 'set local role anon';data:=public.approved_charities_directory();
 if exists(select 1 from jsonb_array_elements(data)x where x->>'id'=c::text) then raise exception 'future_subscription_visible';end if;
 execute 'reset role';
 update public.charity_subscriptions set starts_at=now()-interval '14 days',ends_at=now() where charity_id=c;
 if exists(select 1 from jsonb_array_elements(public.approved_charities_directory())x where x->>'id'=c::text) then raise exception 'expired_visible';end if;
 delete from public.charity_subscriptions where charity_id=c;
 if exists(select 1 from jsonb_array_elements(public.approved_charities_directory())x where x->>'id'=c::text) then raise exception 'missing_subscription_visible';end if;
end $$;
select 'PASS: active visible; future, expired and missing subscriptions hidden from public directory' result;
rollback;
