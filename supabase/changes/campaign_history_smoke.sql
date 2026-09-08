begin;
do $$
declare c uuid; uid uuid; rows jsonb; campaign uuid; draft uuid; payload jsonb;
begin
 select m.user_id,m.charity_id into uid,c from public.charity_members m join public.roles r on r.id=m.role_id join public.charities ch on ch.id=m.charity_id join public.charity_subscriptions s on s.charity_id=ch.id where m.status='active' and r.code='owner' and ch.status='approved' and s.status in('trial','active') and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now()) limit 1;
 if c is null then raise exception 'No owner fixture'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.manage_charity_public_site(jsonb_build_object('published',true));
 execute 'set local role authenticated';
 payload:=jsonb_build_object('kind','campaign','title','Rollback campaign history','published',true,'campaign_status','completed','starts_on','2026-01-01','ends_on','2026-02-01','outcome','Public results');
 rows:=public.manage_public_content(payload);
 select (x->>'id')::uuid into campaign from jsonb_array_elements(rows)x where x->>'title'='Rollback campaign history';
 rows:=public.manage_public_content(jsonb_build_object('kind','campaign','title','Rollback campaign draft','published',false));
 select (x->>'id')::uuid into draft from jsonb_array_elements(rows)x where x->>'title'='Rollback campaign draft';
 begin
  perform public.manage_public_content(payload||jsonb_build_object('id',gen_random_uuid()));
  raise exception 'Cross tenant update accepted';
 exception when raise_exception then if sqlerrm<>'content_not_found' then raise; end if; end;
 begin
  perform public.manage_public_content(payload||jsonb_build_object('id',campaign,'ends_on','2025-01-01'));
  raise exception 'Invalid dates accepted';
 exception when check_violation then null; end;
 execute 'reset role';
 perform set_config('test.charity',c::text,true);perform set_config('test.campaign',campaign::text,true);perform set_config('test.draft',draft::text,true);
end $$;
set local role anon;
do $$ declare site jsonb; begin
 site:=public.public_charity_site(current_setting('test.charity')::uuid);
 if not exists(select 1 from jsonb_array_elements(site->'content')x where x->>'id'=current_setting('test.campaign') and x->>'campaign_status'='completed' and x->>'outcome'='Public results') then raise exception 'Completed campaign missing'; end if;
 if exists(select 1 from jsonb_array_elements(site->'content')x where x->>'id'=current_setting('test.draft')) then raise exception 'Draft leaked'; end if;
 begin perform public.manage_public_content(); raise exception 'Anon mutation allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
