create table public.beneficiary_analysis_requests (
 id uuid primary key default gen_random_uuid(),
 charity_id uuid not null references public.charities(id),
 user_id uuid not null,
 application_id uuid not null references public.beneficiary_applications(id),
 created_at timestamptz not null default now()
);
alter table public.beneficiary_analysis_requests enable row level security;
revoke all on public.beneficiary_analysis_requests from public,anon,authenticated;
create index beneficiary_analysis_user_time on public.beneficiary_analysis_requests(user_id,created_at);
create index beneficiary_analysis_charity on public.beneficiary_analysis_requests(charity_id);
create index beneficiary_analysis_application on public.beneficiary_analysis_requests(application_id);
create or replace function public.reserve_beneficiary_analysis(p_application_id uuid default null,p_beneficiary_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=private.current_charity_id(); h jsonb; request_id uuid;
begin
 if auth.uid() is null or c is null or not private.has_permission('beneficiaries.manage') then raise exception 'forbidden'; end if;
 if (p_application_id is null)=(p_beneficiary_id is null) then raise exception 'invalid_target'; end if;
 h:=public.beneficiary_household(p_application_id,p_beneficiary_id);
 if h->>'application_id' is null or h->'profile' is null or h->'profile'='null'::jsonb then raise exception 'profile_missing'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,17));
 if (select count(*) from public.beneficiary_analysis_requests where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'analysis_rate_limited'; end if;
 insert into public.beneficiary_analysis_requests(charity_id,user_id,application_id) values(c,auth.uid(),(h->>'application_id')::uuid) returning id into request_id;
 return jsonb_build_object('request_id',request_id,'household',h);
end $$;
revoke all on function public.reserve_beneficiary_analysis(uuid,uuid) from public,anon;
grant execute on function public.reserve_beneficiary_analysis(uuid,uuid) to authenticated;
