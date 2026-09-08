begin;
do $$ declare c uuid; uid uuid; begin
 select m.user_id,m.charity_id into uid,c from public.charity_members m join public.roles r on r.id=m.role_id join public.charities ch on ch.id=m.charity_id join public.charity_subscriptions s on s.charity_id=ch.id where m.status='active' and r.code='owner' and ch.status='approved' and s.status in('trial','active') and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now()) limit 1;
 if c is null then raise exception 'No active owner fixture'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('test.media_charity',c::text,true);
end $$;
set local role authenticated;
do $$ declare path text:=current_setting('test.media_charity')||'/logo/'||gen_random_uuid()||'.webp'; begin
 insert into storage.objects(bucket_id,name) values('charity-public-media',path);
 if not exists(select 1 from storage.objects where bucket_id='charity-public-media' and name=path) then raise exception 'Own image not accessible'; end if;
 begin insert into storage.objects(bucket_id,name) values('charity-public-media',gen_random_uuid()||'/logo/test.webp'); raise exception 'Cross tenant upload accepted'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name) values('charity-public-media',current_setting('test.media_charity')||'/documents/test.webp'); raise exception 'Unexpected folder accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin insert into storage.objects(bucket_id,name) values('charity-public-media',current_setting('test.media_charity')||'/logo/anon.webp'); raise exception 'Anonymous upload accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
