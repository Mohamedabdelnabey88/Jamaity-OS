begin;
do $$ declare c uuid; uid uuid; applicant uuid:=gen_random_uuid(); a uuid; begin
 select m.user_id,m.charity_id into uid,c from public.charity_members m join public.roles r on r.id=m.role_id join public.charities ch on ch.id=m.charity_id join public.charity_subscriptions s on s.charity_id=ch.id where m.status='active' and r.code='owner' and ch.status='approved' and s.status in('trial','active') and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now()) limit 1;
 if c is null then raise exception 'No active owner fixture'; end if;
 insert into auth.users(id,email) values(applicant,'rollback-'||applicant||'@example.invalid');
 insert into public.beneficiary_applications(user_id,charity_id,full_name,phone,national_id_hash) values(applicant,c,'Rollback analysis','0500000000',encode(extensions.digest(applicant::text,'sha256'),'hex')) returning id into a;
 insert into public.beneficiary_households values(a,1200,1500,4,3,'married','rented','unemployed','Rollback fictional household',now(),now());
 perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('test.analysis_application',a::text,true);
end $$;
set local role authenticated;
do $$ declare r jsonb; i integer; begin
 r:=public.reserve_beneficiary_analysis(current_setting('test.analysis_application')::uuid,null);
 if r->>'request_id' is null or r->'household'->'profile'->>'monthly_income'<>'1200.00' and (r->'household'->'profile'->>'monthly_income')::numeric<>1200 then raise exception 'Valid profile unavailable'; end if;
 begin perform public.reserve_beneficiary_analysis(gen_random_uuid(),null);raise exception 'Unknown file accepted'; exception when raise_exception then if sqlerrm<>'profile_missing' then raise; end if;end;
 for i in 1..9 loop perform public.reserve_beneficiary_analysis(current_setting('test.analysis_application')::uuid,null);end loop;
 begin perform public.reserve_beneficiary_analysis(current_setting('test.analysis_application')::uuid,null);raise exception 'Quota bypassed';exception when raise_exception then if sqlerrm<>'analysis_rate_limited' then raise;end if;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.reserve_beneficiary_analysis(current_setting('test.analysis_application')::uuid,null);raise exception 'Anon accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
