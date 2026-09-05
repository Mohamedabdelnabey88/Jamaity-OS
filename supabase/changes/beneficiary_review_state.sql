create or replace function public.beneficiary_application_documents_state()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.beneficiary_applications%rowtype; h public.beneficiary_households%rowtype; req text[]; docs jsonb; done integer;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 select * into a from public.beneficiary_applications where user_id=auth.uid() order by created_at desc limit 1;
 if not found then return jsonb_build_object('application',null,'documents','[]'::jsonb,'required_codes','[]'::jsonb,'completion',0); end if;
 select * into h from public.beneficiary_households where application_id=a.id;
 req:=array['national_id','address','income'];
 if h.household_size>1 then req:=array_append(req,'family_card'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'document_type',d.document_type,'original_name',d.original_name,'mime_type',d.mime_type,'size_bytes',d.size_bytes,'review_status',d.review_status,'review_notes',d.review_notes,'created_at',d.created_at,'bucket_id',d.bucket_id,'object_path',d.object_path) order by created_at desc),'[]'::jsonb) into docs from public.beneficiary_application_documents d where d.application_id=a.id and d.user_id=auth.uid();
 select count(distinct document_type) into done from public.beneficiary_application_documents where application_id=a.id and document_type=any(req) and review_status<>'rejected';
 return jsonb_build_object('application',jsonb_build_object('id',a.id,'charity_id',a.charity_id,'status',a.status),'documents',docs,'required_codes',to_jsonb(req),'completion',round(100.0*done/array_length(req,1)));
end $$;

create or replace function public.charity_beneficiary_applications(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c uuid:=private.current_charity_id();
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not(private.has_permission('beneficiaries.view') or private.has_permission('beneficiaries.manage')) then raise exception 'forbidden'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
 select a.id,a.full_name,a.phone,a.status,a.rejection_reason,a.created_at,a.updated_at,a.reviewed_at,a.beneficiary_id,
 round(h.monthly_income/nullif(h.household_size,0),2) income_per_person,h.household_size,h.monthly_income,h.monthly_rent,h.housing,h.updated_at profile_updated_at
 from public.beneficiary_applications a left join public.beneficiary_households h on h.application_id=a.id
 where a.charity_id=c and (p_status is null or a.status=p_status) order by a.created_at desc limit 200)x),'[]'::jsonb);
end $$;
revoke all on function public.beneficiary_application_documents_state(),public.charity_beneficiary_applications(text) from public,anon;
grant execute on function public.beneficiary_application_documents_state(),public.charity_beneficiary_applications(text) to authenticated;
