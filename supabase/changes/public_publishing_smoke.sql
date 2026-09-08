begin;
do $$
declare c uuid; uid uuid; post_id uuid; draft_id uuid; site jsonb;
begin
 select m.user_id,m.charity_id into uid,c from public.charity_members m join public.roles r on r.id=m.role_id join public.charities ch on ch.id=m.charity_id join public.charity_subscriptions s on s.charity_id=ch.id where m.status='active' and r.code='owner' and ch.status='approved' and s.status in('trial','active') and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now()) limit 1;
 if c is null then raise exception 'No active owner fixture'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 site:=public.manage_charity_public_site(jsonb_build_object('published',true));
 execute 'set local role authenticated';
 insert into public.charity_updates(charity_id,title_ar,body_ar,status,published_at) values(c,'Rollback post','Published content','published',now()) returning id into post_id;
 insert into public.charity_updates(charity_id,title_ar,body_ar,status) values(c,'Rollback draft','Private draft','draft') returning id into draft_id;
 execute 'reset role';
 perform set_config('test.charity',c::text,true);perform set_config('test.post',post_id::text,true);perform set_config('test.draft',draft_id::text,true);
end $$;
set local role anon;
do $$
begin
 if public.public_charity_post(current_setting('test.charity')::uuid,current_setting('test.post')::uuid)->>'title'<>'Rollback post' then raise exception 'Published post not readable'; end if;
 if public.public_charity_post(current_setting('test.charity')::uuid,current_setting('test.draft')::uuid) is not null then raise exception 'Draft leaked via RPC'; end if;
 if exists(select 1 from public.charity_updates where id=current_setting('test.draft')::uuid) then raise exception 'Draft leaked directly'; end if;
 if public.public_charity_post(gen_random_uuid(),current_setting('test.post')::uuid) is not null then raise exception 'Cross-charity post exposed'; end if;
end $$;
reset role;
update public.charity_public_sites set published=false where charity_id=current_setting('test.charity')::uuid;
set local role anon;
do $$ begin
 if public.public_charity_post(current_setting('test.charity')::uuid,current_setting('test.post')::uuid) is not null then raise exception 'Unpublished site post exposed via RPC'; end if;
 if exists(select 1 from public.charity_updates where id=current_setting('test.post')::uuid) then raise exception 'Unpublished site post exposed directly'; end if;
end $$;
reset role;
rollback;
