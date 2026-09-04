create table if not exists public.beneficiary_application_documents (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.beneficiary_applications(id) on delete cascade,
 charity_id uuid not null references public.charities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 bucket_id text not null default 'beneficiary-documents',
 object_path text not null unique,
 document_type text not null check (document_type in ('national_id','address','income','family_card','iban','medical','other')),
 original_name text not null,
 mime_type text,
 size_bytes bigint check (size_bytes is null or (size_bytes between 0 and 10485760)),
 review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected')),
 review_notes text,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists beneficiary_application_documents_application_idx on public.beneficiary_application_documents(application_id,created_at desc);
create index if not exists beneficiary_application_documents_charity_review_idx on public.beneficiary_application_documents(charity_id,review_status,created_at desc);
create index if not exists beneficiary_application_documents_user_idx on public.beneficiary_application_documents(user_id,created_at desc);
create index if not exists beneficiary_application_documents_reviewed_by_idx on public.beneficiary_application_documents(reviewed_by);
alter table public.beneficiary_application_documents enable row level security;
revoke all on public.beneficiary_application_documents from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('beneficiary-documents','beneficiary-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists beneficiary_application_documents_self_insert on storage.objects;
create policy beneficiary_application_documents_self_insert on storage.objects for insert to authenticated with check (
 bucket_id='beneficiary-documents' and exists (
  select 1 from public.beneficiary_applications a
  where a.id::text=(storage.foldername(name))[2] and a.charity_id::text=(storage.foldername(name))[1]
    and a.user_id=(select auth.uid()) and a.status in ('submitted','under_review','approved')
 )
);

drop policy if exists beneficiary_application_documents_self_select on storage.objects;
create policy beneficiary_application_documents_self_select on storage.objects for select to authenticated using (
 bucket_id='beneficiary-documents' and exists (
  select 1 from public.beneficiary_applications a
  where a.id::text=(storage.foldername(name))[2] and a.charity_id::text=(storage.foldername(name))[1]
    and a.user_id=(select auth.uid())
 )
);

drop policy if exists beneficiary_application_documents_self_delete on storage.objects;
create policy beneficiary_application_documents_self_delete on storage.objects for delete to authenticated using (
 bucket_id='beneficiary-documents' and exists (
  select 1 from public.beneficiary_applications a
  where a.id::text=(storage.foldername(name))[2] and a.charity_id::text=(storage.foldername(name))[1]
    and a.user_id=(select auth.uid()) and a.status in ('submitted','under_review')
 )
);

create or replace function public.beneficiary_application_documents_state()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare a public.beneficiary_applications%rowtype; docs jsonb; required jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 select * into a from public.beneficiary_applications where user_id=auth.uid() order by created_at desc limit 1;
 if not found then return jsonb_build_object('application',null,'documents','[]'::jsonb,'required','[]'::jsonb,'completion',0); end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',d.id,'document_type',d.document_type,'original_name',d.original_name,'mime_type',d.mime_type,
  'size_bytes',d.size_bytes,'review_status',d.review_status,'review_notes',d.review_notes,'created_at',d.created_at
 ) order by d.created_at desc),'[]'::jsonb) into docs
 from public.beneficiary_application_documents d where d.application_id=a.id and d.user_id=auth.uid();
 required:=jsonb_build_array(
  jsonb_build_object('code','national_id','title','الهوية الوطنية','required',true),
  jsonb_build_object('code','address','title','إثبات العنوان','required',true),
  jsonb_build_object('code','income','title','إثبات الدخل','required',false),
  jsonb_build_object('code','family_card','title','سجل الأسرة','required',false),
  jsonb_build_object('code','iban','title','الآيبان البنكي','required',false),
  jsonb_build_object('code','medical','title','تقرير طبي','required',false)
 );
 return jsonb_build_object(
  'application',jsonb_build_object('id',a.id,'charity_id',a.charity_id,'status',a.status),
  'documents',docs,'required',required,
  'completion',(select least(100,count(distinct document_type) filter(where document_type in('national_id','address'))*50)::int from public.beneficiary_application_documents where application_id=a.id)
 );
end $$;

create or replace function public.register_beneficiary_application_document(
 p_application_id uuid,p_object_path text,p_document_type text,p_original_name text,p_mime_type text default null,p_size_bytes bigint default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare a public.beneficiary_applications%rowtype; did uuid; prefix text;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 select * into a from public.beneficiary_applications where id=p_application_id and user_id=auth.uid() for update;
 if not found then raise exception 'application_not_found'; end if;
 if a.status not in('submitted','under_review','approved') then raise exception 'application_not_open'; end if;
 if p_document_type not in('national_id','address','income','family_card','iban','medical','other') then raise exception 'invalid_document_type'; end if;
 if nullif(trim(p_original_name),'') is null then raise exception 'document_name_required'; end if;
 if p_size_bytes is not null and (p_size_bytes<0 or p_size_bytes>10485760) then raise exception 'document_too_large'; end if;
 if coalesce(p_mime_type,'') not in('application/pdf','image/jpeg','image/png','image/webp') then raise exception 'invalid_mime_type'; end if;
 prefix:=a.charity_id::text||'/'||a.id::text||'/';
 if p_object_path is null or left(p_object_path,length(prefix))<>prefix then raise exception 'invalid_object_path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='beneficiary-documents' and name=p_object_path) then raise exception 'storage_object_not_found'; end if;
 insert into public.beneficiary_application_documents(application_id,charity_id,user_id,object_path,document_type,original_name,mime_type,size_bytes)
 values(a.id,a.charity_id,auth.uid(),p_object_path,p_document_type,trim(p_original_name),p_mime_type,p_size_bytes) returning id into did;
 perform private.log_audit(a.charity_id,auth.uid(),'beneficiary.application_document_registered','beneficiary_application_document',did,null,jsonb_build_object('application_id',a.id,'document_type',p_document_type));
 return jsonb_build_object('id',did,'status','registered');
end $$;

create or replace function public.remove_beneficiary_application_document(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare d public.beneficiary_application_documents%rowtype; a_status text;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 select d0.* into d from public.beneficiary_application_documents d0 where d0.id=p_document_id and d0.user_id=auth.uid() for update;
 if not found then raise exception 'document_not_found'; end if;
 select status into a_status from public.beneficiary_applications where id=d.application_id;
 if a_status not in('submitted','under_review') then raise exception 'application_finalized'; end if;
 delete from storage.objects where bucket_id=d.bucket_id and name=d.object_path;
 delete from public.beneficiary_application_documents where id=d.id;
 perform private.log_audit(d.charity_id,auth.uid(),'beneficiary.application_document_removed','beneficiary_application_document',d.id,to_jsonb(d),null);
 return jsonb_build_object('id',d.id,'status','removed');
end $$;

create or replace function public.charity_beneficiary_application_documents(p_application_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not (private.has_permission('beneficiaries.view') or private.has_permission('beneficiaries.manage')) then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.beneficiary_applications where id=p_application_id and charity_id=c) then raise exception 'application_not_found'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',d.id,'document_type',d.document_type,'original_name',d.original_name,'mime_type',d.mime_type,'size_bytes',d.size_bytes,
  'object_path',d.object_path,'bucket_id',d.bucket_id,'review_status',d.review_status,'review_notes',d.review_notes,'created_at',d.created_at
 ) order by d.created_at desc),'[]'::jsonb) into result
 from public.beneficiary_application_documents d where d.application_id=p_application_id and d.charity_id=c;
 return result;
end $$;

create or replace function public.review_beneficiary_application_document(p_document_id uuid,p_status text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c uuid:=private.current_charity_id(); d public.beneficiary_application_documents%rowtype;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('beneficiaries.manage') then raise exception 'forbidden'; end if;
 if p_status not in('accepted','rejected','pending') then raise exception 'invalid_status'; end if;
 select * into d from public.beneficiary_application_documents where id=p_document_id and charity_id=c for update;
 if not found then raise exception 'document_not_found'; end if;
 if p_status='rejected' and nullif(trim(coalesce(p_notes,'')),'') is null then raise exception 'review_notes_required'; end if;
 update public.beneficiary_application_documents set review_status=p_status,review_notes=nullif(trim(coalesce(p_notes,'')),''),
 reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=d.id;
 perform private.log_audit(c,auth.uid(),'beneficiary.application_document_reviewed','beneficiary_application_document',d.id,to_jsonb(d),jsonb_build_object('review_status',p_status,'review_notes',p_notes));
 return jsonb_build_object('id',d.id,'review_status',p_status);
end $$;

revoke all on function public.beneficiary_application_documents_state() from public,anon;
revoke all on function public.register_beneficiary_application_document(uuid,text,text,text,text,bigint) from public,anon;
revoke all on function public.remove_beneficiary_application_document(uuid) from public,anon;
revoke all on function public.charity_beneficiary_application_documents(uuid) from public,anon;
revoke all on function public.review_beneficiary_application_document(uuid,text,text) from public,anon;
grant execute on function public.beneficiary_application_documents_state() to authenticated;
grant execute on function public.register_beneficiary_application_document(uuid,text,text,text,text,bigint) to authenticated;
grant execute on function public.remove_beneficiary_application_document(uuid) to authenticated;
grant execute on function public.charity_beneficiary_application_documents(uuid) to authenticated;
grant execute on function public.review_beneficiary_application_document(uuid,text,text) to authenticated;
