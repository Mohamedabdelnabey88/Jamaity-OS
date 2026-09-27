-- Per-charity official donor letterhead templates and generated thank-you documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'charity-letterheads','charity-letterheads',false,10485760,
  array[
    'image/png','image/jpeg','image/webp','application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.charity_document_templates(
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  template_kind text not null check(template_kind in ('donor_thank_you')),
  background_object_path text,
  source_object_path text,
  body_template text not null,
  content_top_mm numeric(6,2) not null default 62,
  content_side_mm numeric(6,2) not null default 22,
  font_size_pt numeric(5,2) not null default 13,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(charity_id,template_kind)
);

create table if not exists public.donation_thank_you_documents(
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  donation_id uuid not null references public.donations(id) on delete cascade,
  template_id uuid references public.charity_document_templates(id) on delete set null,
  object_path text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists charity_document_templates_charity_idx on public.charity_document_templates(charity_id,template_kind);
create index if not exists donation_thank_you_documents_charity_idx on public.donation_thank_you_documents(charity_id,created_at desc);
create index if not exists donation_thank_you_documents_donation_idx on public.donation_thank_you_documents(donation_id,created_at desc);
create index if not exists donation_thank_you_documents_created_by_idx on public.donation_thank_you_documents(created_by);

alter table public.charity_document_templates enable row level security;
alter table public.donation_thank_you_documents enable row level security;
revoke all on table public.charity_document_templates from public,anon,authenticated;
revoke all on table public.donation_thank_you_documents from public,anon,authenticated;

drop policy if exists charity_letterheads_select on storage.objects;
create policy charity_letterheads_select on storage.objects for select to authenticated
using(
  bucket_id='charity-letterheads'
  and (storage.foldername(name))[1]=private.current_charity_id()::text
  and (private.has_permission('onboarding.manage') or private.has_permission('donations.manage') or private.has_permission('donors.manage'))
);

drop policy if exists charity_letterheads_insert on storage.objects;
create policy charity_letterheads_insert on storage.objects for insert to authenticated
with check(
  bucket_id='charity-letterheads'
  and (storage.foldername(name))[1]=private.current_charity_id()::text
  and (private.has_permission('onboarding.manage') or private.has_permission('donations.manage') or private.has_permission('donors.manage'))
);

drop policy if exists charity_letterheads_update on storage.objects;
create policy charity_letterheads_update on storage.objects for update to authenticated
using(bucket_id='charity-letterheads' and (storage.foldername(name))[1]=private.current_charity_id()::text and private.has_permission('onboarding.manage'))
with check(bucket_id='charity-letterheads' and (storage.foldername(name))[1]=private.current_charity_id()::text and private.has_permission('onboarding.manage'));

drop policy if exists charity_letterheads_delete on storage.objects;
create policy charity_letterheads_delete on storage.objects for delete to authenticated
using(bucket_id='charity-letterheads' and (storage.foldername(name))[1]=private.current_charity_id()::text and private.has_permission('onboarding.manage'));

create or replace function public.donor_thank_you_template()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare c uuid:=private.current_charity_id();t public.charity_document_templates%rowtype;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not (private.has_permission('onboarding.manage') or private.has_permission('donations.manage') or private.has_permission('donors.manage')) then raise exception 'permission_denied'; end if;
 select * into t from public.charity_document_templates where charity_id=c and template_kind='donor_thank_you' and active=true;
 if not found then return null; end if;
 return jsonb_build_object(
  'id',t.id,'background_object_path',t.background_object_path,'source_object_path',t.source_object_path,
  'body_template',t.body_template,'content_top_mm',t.content_top_mm,'content_side_mm',t.content_side_mm,
  'font_size_pt',t.font_size_pt,'updated_at',t.updated_at
 );
end
$function$;

create or replace function public.save_donor_thank_you_template(
 p_background_object_path text,p_source_object_path text,p_body_template text,
 p_content_top_mm numeric,p_content_side_mm numeric,p_font_size_pt numeric
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 c uuid:=private.current_charity_id();tid uuid;
 bg text:=nullif(trim(coalesce(p_background_object_path,'')),'');
 src text:=nullif(trim(coalesce(p_source_object_path,'')),'');
 body text:=trim(coalesce(p_body_template,''));
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('onboarding.manage') then raise exception 'permission_denied'; end if;
 if bg is null then raise exception 'background_required'; end if;
 if body='' then raise exception 'body_template_required'; end if;
 if length(body)>6000 then raise exception 'body_template_too_long'; end if;
 if bg not like c::text||'/%' then raise exception 'invalid_background_path'; end if;
 if src is not null and src not like c::text||'/%' then raise exception 'invalid_source_path'; end if;
 if p_content_top_mm not between 30 and 120 then raise exception 'invalid_content_top'; end if;
 if p_content_side_mm not between 10 and 45 then raise exception 'invalid_content_side'; end if;
 if p_font_size_pt not between 10 and 20 then raise exception 'invalid_font_size'; end if;

 insert into public.charity_document_templates(
  charity_id,template_kind,background_object_path,source_object_path,body_template,
  content_top_mm,content_side_mm,font_size_pt,active,created_by,updated_by
 ) values(
  c,'donor_thank_you',bg,src,body,p_content_top_mm,p_content_side_mm,p_font_size_pt,true,auth.uid(),auth.uid()
 )
 on conflict(charity_id,template_kind) do update set
  background_object_path=excluded.background_object_path,source_object_path=excluded.source_object_path,
  body_template=excluded.body_template,content_top_mm=excluded.content_top_mm,content_side_mm=excluded.content_side_mm,
  font_size_pt=excluded.font_size_pt,active=true,updated_by=auth.uid(),updated_at=now()
 returning id into tid;

 perform private.log_audit(c,auth.uid(),'template.donor_thank_you_saved','charity_document_template',tid,null,jsonb_build_object('template_kind','donor_thank_you'));
 return public.donor_thank_you_template();
end
$function$;

create or replace function public.register_donation_thank_you_document(
 p_donation_id uuid,p_template_id uuid,p_object_path text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare c uuid:=private.current_charity_id();doc_id uuid;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not (private.has_permission('donations.manage') or private.has_permission('donors.manage')) then raise exception 'permission_denied'; end if;
 if not exists(select 1 from public.donations where id=p_donation_id and charity_id=c and status='received') then raise exception 'donation_not_received'; end if;
 if p_template_id is not null and not exists(select 1 from public.charity_document_templates where id=p_template_id and charity_id=c and template_kind='donor_thank_you') then raise exception 'template_not_found'; end if;
 if nullif(trim(coalesce(p_object_path,'')),'') is null or p_object_path not like c::text||'/%' then raise exception 'invalid_document_path'; end if;

 insert into public.donation_thank_you_documents(charity_id,donation_id,template_id,object_path,created_by)
 values(c,p_donation_id,p_template_id,p_object_path,auth.uid())
 returning id into doc_id;

 perform private.log_audit(c,auth.uid(),'donation.thank_you_document_created','donation',p_donation_id,null,jsonb_build_object('document_id',doc_id,'object_path',p_object_path));
 return jsonb_build_object('id',doc_id,'object_path',p_object_path,'created_at',now());
end
$function$;

revoke execute on function public.donor_thank_you_template() from public,anon;
grant execute on function public.donor_thank_you_template() to authenticated;
revoke execute on function public.save_donor_thank_you_template(text,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.save_donor_thank_you_template(text,text,text,numeric,numeric,numeric) to authenticated;
revoke execute on function public.register_donation_thank_you_document(uuid,uuid,text) from public,anon;
grant execute on function public.register_donation_thank_you_document(uuid,uuid,text) to authenticated;
