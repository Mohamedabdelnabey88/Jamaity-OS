begin;
do $$
declare u uuid:=gen_random_uuid();u2 uuid:=gen_random_uuid();applicant uuid:=gen_random_uuid();c uuid;c2 uuid;admin_id uuid:=gen_random_uuid();a uuid;b uuid;manual_id uuid:=gen_random_uuid();r uuid:=gen_random_uuid();result jsonb;
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 select x,'authenticated','authenticated','beneficiary-smoke-'||x||'@example.invalid',now(),'{}','{}' from unnest(array[u,u2,applicant,admin_id]) x;
 insert into public.platform_admins(user_id) values(admin_id);
 perform set_config('request.jwt.claim.sub',u::text,true);c:=public.register_charity('Rollback beneficiary A',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',u2::text,true);c2:=public.register_charity('Rollback beneficiary B',null,'أبها','عسير',null);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform public.platform_set_charity_status(c,'approved');perform public.platform_set_charity_status(c2,'approved');
 insert into public.beneficiary_applications(user_id,charity_id,full_name,phone,national_id_hash) values(applicant,c,'Synthetic applicant','0500000000',encode(extensions.digest(applicant::text,'sha256'),'hex')) returning id into a;
 insert into public.beneficiary_households values(a,1200,1500,1,0,'single','rented','unemployed','Synthetic need',now(),now());
 insert into public.beneficiary_application_documents(application_id,charity_id,user_id,object_path,document_type,original_name,review_status,reviewed_at,reviewed_by)
 select a,c,applicant,c||'/applications/'||a||'/'||t||'.pdf',t,t||'.pdf','accepted',now(),u from unnest(array['national_id','address','income']) t;
 perform set_config('request.jwt.claim.sub',u::text,true);
 result:=public.review_beneficiary_application(a,'approved');b:=(result->>'beneficiary_id')::uuid;
 insert into public.beneficiary_documents(charity_id,beneficiary_id,object_path,document_type,original_name) values(c,b,c||'/'||b||'/staff.pdf','document','staff.pdf');
 execute 'set local role authenticated';
 result:=public.charity_beneficiary_documents(b);
 if jsonb_array_length(result)<>4 or (select count(*) from jsonb_array_elements(result) x where x->>'source'='application')<>3 then raise exception 'missing_application_documents';end if;
 if exists(select 1 from jsonb_array_elements(result) x where x->>'source'='application' and (x->>'can_delete')::boolean) then raise exception 'application_delete_allowed';end if;
 result:=public.create_charity_beneficiary(manual_id,'Manual fixture','0500000001');
 if result->>'status'<>'inactive' then raise exception 'manual_automatically_approved';end if;
 perform public.create_charity_beneficiary(manual_id,'Manual fixture','0500000001');
 begin perform public.create_charity_beneficiary(gen_random_uuid(),'x',null);raise exception 'invalid_name_accepted';exception when others then if sqlerrm<>'invalid_beneficiary_name' then raise;end if;end;
 begin perform public.create_charity_beneficiary(gen_random_uuid(),'Test','abc');raise exception 'invalid_phone_accepted';exception when others then if sqlerrm<>'invalid_beneficiary_phone' then raise;end if;end;
 execute 'reset role';
 if (select count(*) from public.beneficiaries where id=manual_id)<>1 then raise exception 'retry_duplicated';end if;
 if exists(select 1 from public.beneficiary_accounts where beneficiary_id=manual_id) then raise exception 'manual_portal_created';end if;
 perform set_config('request.jwt.claim.sub',u2::text,true);execute 'set local role authenticated';
 begin perform public.charity_beneficiary_documents(b);raise exception 'cross_tenant_documents';exception when others then if sqlerrm<>'beneficiary_not_found' then raise;end if;end;
 begin perform public.create_charity_beneficiary(manual_id,'Manual fixture','0500000001');raise exception 'cross_tenant_retry';exception when others then if sqlerrm<>'beneficiary_request_conflict' then raise;end if;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.roles(id,code,name_ar,name_en,is_system,charity_id) values(r,'reader_'||replace(r::text,'-',''),'قارئ','Reader',false,c);
 insert into public.role_permissions(role_id,permission_id) select r,id from public.permissions where code='beneficiaries.view';
 update public.charity_members set role_id=r where user_id=u and charity_id=c;
 execute 'set local role authenticated';result:=public.charity_beneficiary_documents(b);
 if jsonb_array_length(result)<>4 or exists(select 1 from jsonb_array_elements(result) x where (x->>'can_delete')::boolean) then raise exception 'reader_documents_wrong';end if;
 begin perform public.create_charity_beneficiary(gen_random_uuid(),'Forbidden',null);raise exception 'reader_created';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',admin_id::text,true);execute 'set local role authenticated';
 begin perform public.charity_beneficiary_documents(b);raise exception 'platform_documents';exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 execute 'reset role';execute 'set local role anon';
 begin perform public.charity_beneficiary_documents(b);raise exception 'anon_documents';exception when insufficient_privilege then null;end;
 begin perform public.create_charity_beneficiary(gen_random_uuid(),'Forbidden',null);raise exception 'anon_created';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
select 'PASS: approved application evidence visible with file documents; manual inactive record/retry/validation; tenant, reader, platform and anon isolation' result;
rollback;
