-- Private household records and an explicitly published charity microsite.
create table public.beneficiary_households (
 application_id uuid primary key references public.beneficiary_applications(id) on delete cascade,
 monthly_income numeric(12,2) not null check(monthly_income between 0 and 10000000),
 monthly_rent numeric(12,2) not null check(monthly_rent between 0 and 10000000),
 household_size integer not null check(household_size between 1 and 100),
 dependents integer not null check(dependents between 0 and 99),
 marital_status text not null check(marital_status in('single','married','divorced','widowed')),
 housing text not null check(housing in('owned','rented','hosted','temporary')),
 employment text not null check(employment in('employed','unemployed','retired','self_employed','unable')),
 needs_description text not null check(length(needs_description) between 10 and 3000),
 declaration_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(dependents < household_size),
 check(housing='rented' or monthly_rent=0)
);
alter table public.beneficiary_households enable row level security;
revoke all on public.beneficiary_households from anon,authenticated;

create or replace function public.save_my_beneficiary_household(p_income numeric,p_rent numeric,p_size integer,p_dependents integer,p_marital text,p_housing text,p_employment text,p_needs text,p_declaration boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.beneficiary_applications%rowtype;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 select * into a from public.beneficiary_applications where user_id=auth.uid() order by created_at desc limit 1 for update;
 if not found then raise exception 'application_not_found'; end if;
 if a.status not in('submitted','under_review','rejected') then raise exception 'application_finalized'; end if;
 if p_declaration is distinct from true then raise exception 'declaration_required'; end if;
 insert into public.beneficiary_households(application_id,monthly_income,monthly_rent,household_size,dependents,marital_status,housing,employment,needs_description)
 values(a.id,p_income,p_rent,p_size,p_dependents,p_marital,p_housing,p_employment,trim(p_needs))
 on conflict(application_id) do update set monthly_income=excluded.monthly_income,monthly_rent=excluded.monthly_rent,household_size=excluded.household_size,dependents=excluded.dependents,marital_status=excluded.marital_status,housing=excluded.housing,employment=excluded.employment,needs_description=excluded.needs_description,declaration_at=now(),updated_at=now();
 perform private.log_audit(a.charity_id,auth.uid(),'beneficiary.household_updated','beneficiary_application',a.id,null,jsonb_build_object('updated_at',now()));
 return jsonb_build_object('saved',true);
end $$;

create or replace function public.beneficiary_household(p_application_id uuid default null,p_beneficiary_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.beneficiary_applications%rowtype; h jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if p_application_id is not null or p_beneficiary_id is not null then
  if private.current_charity_id() is null or not (private.has_permission('beneficiaries.view') or private.has_permission('beneficiaries.manage')) then raise exception 'forbidden'; end if;
  select * into a from public.beneficiary_applications where charity_id=private.current_charity_id() and (id=p_application_id or beneficiary_id=p_beneficiary_id) order by created_at desc limit 1;
 else
  select * into a from public.beneficiary_applications where user_id=auth.uid() order by created_at desc limit 1;
 end if;
 if a.id is null then return '{}'::jsonb; end if;
 select to_jsonb(x) into h from public.beneficiary_households x where application_id=a.id;
 return jsonb_build_object('application_id',a.id,'status',a.status,'profile',h,'income_per_person',case when h is not null then round((h->>'monthly_income')::numeric/(h->>'household_size')::numeric,2) else null end,'remaining_after_rent',case when h is not null then (h->>'monthly_income')::numeric-(h->>'monthly_rent')::numeric else null end);
end $$;

-- Database-enforced uniqueness prevents racing submissions, including alternate emails.
create unique index beneficiary_global_identity_unique on public.beneficiaries(national_id_hash) where national_id_hash is not null;
create unique index beneficiary_application_global_identity_active on public.beneficiary_applications(national_id_hash) where status in('submitted','under_review','approved');
create unique index beneficiary_application_global_user_active on public.beneficiary_applications(user_id) where status in('submitted','under_review','approved');

create or replace function private.guard_beneficiary_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.national_id_hash is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.national_id_hash,0));
 if tg_table_name='beneficiary_applications' then
  if new.status in('submitted','under_review','approved') and exists(select 1 from public.beneficiaries b where b.national_id_hash=new.national_id_hash and (b.id is distinct from new.beneficiary_id or b.charity_id<>new.charity_id)) then raise exception 'identity_already_registered'; end if;
  if tg_op='UPDATE' and (old.national_id_hash<>new.national_id_hash or old.user_id<>new.user_id or old.charity_id<>new.charity_id) then raise exception 'identity_change_requires_review'; end if;
 else
  if exists(select 1 from public.beneficiary_applications a where a.national_id_hash=new.national_id_hash and a.status in('submitted','under_review','approved') and a.charity_id<>new.charity_id) then raise exception 'identity_already_registered'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_beneficiary_identity() from public,anon,authenticated;
create trigger guard_beneficiary_identity before insert or update on public.beneficiaries for each row execute function private.guard_beneficiary_identity();
create trigger guard_application_identity before insert or update on public.beneficiary_applications for each row execute function private.guard_beneficiary_identity();

-- New approvals require reviewed evidence, while already-approved files remain intact.
create or replace function private.guard_beneficiary_approval_evidence()
returns trigger language plpgsql security definer set search_path='' as $$
declare h public.beneficiary_households%rowtype; required_types text[];
begin
 if new.status='approved' and old.status is distinct from 'approved' then
  select * into h from public.beneficiary_households where application_id=new.id;
  if not found then raise exception 'household_profile_required'; end if;
  required_types:=array['national_id','address','income'];
  if h.household_size>1 then required_types:=array_append(required_types,'family_card'); end if;
  if exists(select 1 from unnest(required_types) t where not exists(select 1 from public.beneficiary_application_documents d where d.application_id=new.id and d.document_type=t and d.review_status='accepted' and d.reviewed_at>=h.updated_at)) then raise exception 'review_required_evidence_after_profile_update'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_beneficiary_approval_evidence() from public,anon,authenticated;
create trigger guard_beneficiary_approval_evidence before update on public.beneficiary_applications for each row execute function private.guard_beneficiary_approval_evidence();

create table public.charity_public_sites(
 charity_id uuid primary key references public.charities(id) on delete cascade,
 mission text not null default '',vision text not null default '',programs text not null default '',
 contact_email text not null default '',contact_phone text not null default '',address text not null default '',
 bank_name text not null default '',bank_holder text not null default '',iban text not null default '',
 published boolean not null default false,updated_at timestamptz not null default now()
);
alter table public.charity_public_sites enable row level security;
revoke all on public.charity_public_sites from anon,authenticated;

create or replace function public.manage_charity_public_site(p_data jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=private.current_charity_id(); r jsonb; v_iban text; rem integer:=0; ch text; digits text; i integer;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('onboarding.manage') then raise exception 'forbidden'; end if;
 if p_data is not null then
  if jsonb_typeof(p_data)<>'object' or length(p_data::text)>18000 then raise exception 'invalid_site_data'; end if;
  v_iban:=upper(regexp_replace(coalesce(p_data->>'iban',''),'\s','','g'));
  if v_iban<>'' then
   if v_iban !~ '^SA[0-9]{22}$' or nullif(trim(p_data->>'bank_name'),'') is null or nullif(trim(p_data->>'bank_holder'),'') is null then raise exception 'invalid_bank_account'; end if;
   digits:=substring(v_iban from 5)||'2810'||substring(v_iban from 3 for 2);
   for i in 1..length(digits) loop rem:=(rem*10+substring(digits from i for 1)::integer)%97; end loop;
   if rem<>1 then raise exception 'invalid_iban_checksum'; end if;
  end if;
  insert into public.charity_public_sites(charity_id,mission,vision,programs,contact_email,contact_phone,address,bank_name,bank_holder,iban,published)
  values(c,coalesce(p_data->>'mission',''),coalesce(p_data->>'vision',''),coalesce(p_data->>'programs',''),coalesce(p_data->>'contact_email',''),coalesce(p_data->>'contact_phone',''),coalesce(p_data->>'address',''),coalesce(p_data->>'bank_name',''),coalesce(p_data->>'bank_holder',''),v_iban,coalesce((p_data->>'published')::boolean,false))
  on conflict(charity_id) do update set mission=excluded.mission,vision=excluded.vision,programs=excluded.programs,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,address=excluded.address,bank_name=excluded.bank_name,bank_holder=excluded.bank_holder,iban=excluded.iban,published=excluded.published,updated_at=now();
  perform private.log_audit(c,auth.uid(),'charity.public_site_updated','charity',c,null,jsonb_build_object('published',p_data->>'published'));
 end if;
 select to_jsonb(s) into r from public.charity_public_sites s where charity_id=c;
 return jsonb_build_object('charity_id',c,'site',coalesce(r,'{}'::jsonb));
end $$;

create or replace function public.public_charity_site(p_charity_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('charity',jsonb_build_object('id',c.id,'name_ar',c.name_ar,'city',c.city,'region',c.region,'description_ar',c.description_ar,'logo_url',c.logo_url),'site',to_jsonb(s)-'charity_id','updates',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'title',u.title_ar,'body',u.body_ar,'published_at',u.published_at)) from (select * from public.charity_updates where charity_id=c.id and status='published' order by published_at desc limit 12)u),'[]'::jsonb))
 from public.charities c join public.charity_public_sites s on s.charity_id=c.id
 where c.id=p_charity_id and c.status='approved' and s.published and exists(select 1 from public.charity_subscriptions t where t.charity_id=c.id and t.status in('trial','active') and t.starts_at<=now() and (t.ends_at is null or t.ends_at>now()));
$$;
revoke all on function public.save_my_beneficiary_household(numeric,numeric,integer,integer,text,text,text,text,boolean) from public,anon;
revoke all on function public.beneficiary_household(uuid,uuid) from public,anon;
revoke all on function public.manage_charity_public_site(jsonb) from public,anon;
revoke all on function public.public_charity_site(uuid) from public;
grant execute on function public.save_my_beneficiary_household(numeric,numeric,integer,integer,text,text,text,text,boolean),public.beneficiary_household(uuid,uuid),public.manage_charity_public_site(jsonb) to authenticated;
grant execute on function public.public_charity_site(uuid) to anon,authenticated;
