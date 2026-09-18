create or replace function public.charity_beneficiary_documents(p_beneficiary_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c uuid:=private.current_charity_id();result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated';end if;
 if c is null or not (private.has_permission('beneficiaries.view') or private.has_permission('beneficiaries.manage')) then raise exception 'forbidden';end if;
 if not exists(select 1 from public.beneficiaries b where b.id=p_beneficiary_id and b.charity_id=c) then raise exception 'beneficiary_not_found';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) into result from (
  select d.id,d.bucket_id,d.object_path,d.document_type,d.original_name,d.mime_type,d.size_bytes,d.created_at,d.source,null::text review_status,
   (private.has_permission('documents.manage') or private.has_permission('beneficiaries.manage')) can_delete
  from public.beneficiary_documents d where d.charity_id=c and d.beneficiary_id=p_beneficiary_id
  union all
  select d.id,d.bucket_id,d.object_path,d.document_type,d.original_name,d.mime_type,d.size_bytes,d.created_at,'application'::text,d.review_status,false
  from public.beneficiary_application_documents d join public.beneficiary_applications a on a.id=d.application_id and a.charity_id=d.charity_id
  where a.charity_id=c and a.beneficiary_id=p_beneficiary_id and a.status='approved'
 ) x;
 return result;
end $$;
revoke all on function public.charity_beneficiary_documents(uuid) from public,anon;
grant execute on function public.charity_beneficiary_documents(uuid) to authenticated;

create or replace function public.create_charity_beneficiary(p_request_id uuid,p_full_name text,p_phone text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=private.current_charity_id();b public.beneficiaries%rowtype;v_name text:=btrim(p_full_name);v_phone text:=nullif(regexp_replace(coalesce(p_phone,''),'[[:space:]-]','','g'),'');
begin
 if auth.uid() is null then raise exception 'not_authenticated';end if;
 if c is null or not private.has_permission('beneficiaries.manage') then raise exception 'forbidden';end if;
 if p_request_id is null or v_name is null or length(v_name)<2 or length(v_name)>160 then raise exception 'invalid_beneficiary_name';end if;
 if v_phone is not null and v_phone!~'^\+?[0-9]{8,15}$' then raise exception 'invalid_beneficiary_phone';end if;
 insert into public.beneficiaries(id,charity_id,full_name,phone,status) values(p_request_id,c,v_name,v_phone,'inactive') on conflict(id) do nothing returning * into b;
 if not found then
  select * into b from public.beneficiaries where id=p_request_id and charity_id=c;
  if not found or b.full_name<>v_name or b.phone is distinct from v_phone then raise exception 'beneficiary_request_conflict';end if;
 else
  perform private.log_audit(c,auth.uid(),'beneficiary.created_manually','beneficiary',b.id,null,jsonb_build_object('status','inactive'));
 end if;
 return jsonb_build_object('id',b.id,'status',b.status);
end $$;
revoke all on function public.create_charity_beneficiary(uuid,text,text) from public,anon;
grant execute on function public.create_charity_beneficiary(uuid,text,text) to authenticated;
