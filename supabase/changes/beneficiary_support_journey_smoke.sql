begin;
do $$
declare u uuid:=gen_random_uuid();u2 uuid:=gen_random_uuid();applicant uuid:=gen_random_uuid();c uuid;c2 uuid;admin_id uuid:=gen_random_uuid();a uuid;b uuid;manual_id uuid:=gen_random_uuid();r uuid:=gen_random_uuid();result jsonb;req uuid;support_id uuid;
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 select x,'authenticated','authenticated','beneficiary-smoke-'||x||'@example.invalid',now(),'{}','{}' from unnest(array[u,u2,applicant,admin_id]) x;
 insert into public.platform_admins(user_id) values(admin_id);
 perform set_config('request.jwt.claim.sub',u::text,true);c:=public.register_charity('Rollback beneficiary A',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',u2::text,true);c2:=public.register_charity('Rollback beneficiary B',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform public.platform_set_charity_status(c,'approved');perform public.platform_set_charity_status(c2,'approved');
 insert into public.beneficiary_applications(user_id,charity_id,full_name,phone,national_id_hash) values(applicant,c,'Synthetic applicant','0500000000',encode(extensions.digest(applicant::text,'sha256'),'hex')) returning id into a;
 insert into public.beneficiary_households values(a,1200,1500,1,0,'single','rented','unemployed','Synthetic need',now(),now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin perform public.review_beneficiary_application(a,'approved');raise exception 'missing_evidence_accepted';exception when others then if sqlerrm<>'review_required_evidence_after_profile_update' then raise;end if;end;
 insert into public.beneficiary_application_documents(application_id,charity_id,user_id,object_path,document_type,original_name,review_status,reviewed_at,reviewed_by)
 select a,c,applicant,c||'/applications/'||a||'/'||t||'.pdf',t,t||'.pdf','accepted',now(),u from unnest(array['national_id','address','income']) t;
 perform set_config('request.jwt.claim.sub',u::text,true);
 result:=public.review_beneficiary_application(a,'approved');b:=(result->>'beneficiary_id')::uuid;

 perform set_config('request.jwt.claim.sub',applicant::text,true);execute 'set local role authenticated';
 result:=public.create_beneficiary_support_request('financial','Synthetic support','Synthetic request for rollback',125,null);req:=(result->>'id')::uuid;
 execute 'reset role';perform set_config('request.jwt.claim.sub',u2::text,true);execute 'set local role authenticated';
 begin perform public.review_beneficiary_support_request(req,'approved');raise exception 'foreign_request_approved';exception when others then if sqlerrm<>'request_not_found' then raise;end if;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 perform public.accounting_initialize();
 result:=public.review_beneficiary_support_request(req,'approved');support_id:=(result->>'support_record_id')::uuid;
 perform public.approve_support(support_id);perform public.execute_support(support_id);
 execute 'reset role';
 if not exists(select 1 from public.beneficiary_support_requests where id=req and status='fulfilled') then raise exception 'request_not_fulfilled';end if;
 if (select count(*) from public.journal_entries where reference_id=support_id and reference_type='support')<>1 then raise exception 'support_ledger_missing';end if;
 perform set_config('request.jwt.claim.sub',applicant::text,true);execute 'set local role authenticated';
 result:=public.beneficiary_portal_summary();
 if not exists(select 1 from jsonb_array_elements(result->'support')x where x->>'id'=support_id::text and x->>'status'='provided' and (x->>'amount')::numeric=125) then raise exception 'portal_support_missing';end if;
 execute 'reset role';
end $$;
select 'PASS: evidence required, approval/account linkage, request, tenant denial, approval/execution, fulfilled status, ledger and beneficiary portal' result;
rollback;
