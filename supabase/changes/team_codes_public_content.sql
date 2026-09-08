-- Canonical invitation storage, tenant-specific staff enrollment, and editorial public content.
create sequence public.charity_code_sequence start 100001;
revoke all on sequence public.charity_code_sequence from public,anon,authenticated;
alter table public.charities add column charity_code text not null default ('JM-'||nextval('public.charity_code_sequence')::text);
create unique index charities_code_unique on public.charities(charity_code);

create or replace function public.charity_profile() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c uuid:=private.current_charity_id(); result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null then raise exception 'forbidden'; end if;
 select to_jsonb(x) into result from (select id,charity_code,name_ar,name_en,slug,city,region,description_ar,logo_url,status,verified_at,created_at from public.charities where id=c)x;
 return result;
end $$;

create or replace function public.accept_member_invitation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.member_invitations%rowtype; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'not_authenticated'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if p_token is null or length(p_token)<>64 then raise exception 'invalid_invitation'; end if;
 select * into inv from public.member_invitations where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
 if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at<=now() then raise exception 'invitation_expired_or_invalid'; end if;
 if not exists(select 1 from auth.users where id=uid and lower(email)=lower(inv.email) and email_confirmed_at is not null) then raise exception 'invitation_email_mismatch_or_unconfirmed'; end if;
 if exists(select 1 from public.platform_admins where user_id=uid) then raise exception 'platform_account_cannot_join_charity'; end if;
 if exists(select 1 from public.charity_members where user_id=uid) then raise exception 'account_already_linked'; end if;
 if not exists(select 1 from public.roles where id=inv.role_id and code<>'owner' and (charity_id=inv.charity_id or (charity_id is null and is_system))) then raise exception 'invalid_role'; end if;
 if not exists(select 1 from public.charities c join public.charity_subscriptions s on s.charity_id=c.id where c.id=inv.charity_id and c.status='approved' and s.status in('trial','active') and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now())) then raise exception 'charity_unavailable'; end if;
 insert into public.charity_members(charity_id,user_id,role_id,status) values(inv.charity_id,uid,inv.role_id,'active');
 update public.member_invitations set accepted_at=now() where id=inv.id;
 perform private.log_audit(inv.charity_id,uid,'team.invitation_accepted','member_invitation',inv.id,null,jsonb_build_object('role_id',inv.role_id));
 return jsonb_build_object('charity_id',inv.charity_id,'role_id',inv.role_id);
end $$;
create or replace function public.accept_team_invitation(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select public.accept_member_invitation(p_token); $$;

create or replace function public.accept_staff_invitation(p_token text,p_charity_code text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.member_invitations i join public.charities c on c.id=i.charity_id where i.token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') and c.charity_code=upper(trim(p_charity_code))) then raise exception 'charity_code_mismatch'; end if;
 return public.accept_member_invitation(p_token);
end $$;

create or replace function public.team_center() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c uuid:=private.current_charity_id();
begin
 if auth.uid() is null or c is null or not(private.has_permission('team.manage') or private.has_permission('roles.manage')) then raise exception 'forbidden'; end if;
 return jsonb_build_object('charity',public.charity_profile(),'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role_id',m.role_id,'status',m.status,'full_name',left(coalesce(u.raw_user_meta_data->>'full_name',''),150),'email',u.email,'roles',jsonb_build_object('name_ar',r.name_ar,'code',r.code)) order by m.created_at) from public.charity_members m join auth.users u on u.id=m.user_id left join public.roles r on r.id=m.role_id where m.charity_id=c),'[]'::jsonb),'invitations',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select i.id,i.email,i.expires_at,i.created_at,r.name_ar role_name,case when i.revoked_at is not null then 'revoked' when i.accepted_at is not null then 'accepted' when i.expires_at<=now() then 'expired' else 'pending' end status from public.member_invitations i join public.roles r on r.id=i.role_id where i.charity_id=c order by i.created_at desc limit 100)x),'[]'::jsonb));
end $$;
create or replace function public.revoke_staff_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c uuid:=private.current_charity_id();
begin
 if auth.uid() is null or c is null or not private.has_permission('team.manage') then raise exception 'forbidden'; end if;
 update public.member_invitations set revoked_at=now() where id=p_id and charity_id=c and accepted_at is null and revoked_at is null;
 if not found then raise exception 'invitation_unavailable'; end if;
 perform private.log_audit(c,auth.uid(),'team.invitation_revoked','member_invitation',p_id,null,null);
end $$;

create table public.charity_public_content(
 id uuid primary key default gen_random_uuid(),charity_id uuid not null references public.charities(id),
 kind text not null check(kind in('board','campaign','impact','disclosure')),
 title text not null check(length(title) between 2 and 180),body text not null default '' check(length(body)<=6000),
 image_url text,link_url text,donation_type text check(donation_type in('cash','in_kind')),target_amount numeric(14,2) check(target_amount>0),
 published boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(image_url is null or image_url ~ '^https://'),check(link_url is null or link_url ~ '^https://')
);
create index charity_public_content_tenant_idx on public.charity_public_content(charity_id,kind);
alter table public.charity_public_content enable row level security;
revoke all on public.charity_public_content from public,anon,authenticated;

create or replace function public.manage_public_content(p_data jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=private.current_charity_id(); row_id uuid;
begin
 if auth.uid() is null or c is null or not private.has_permission('onboarding.manage') then raise exception 'forbidden'; end if;
 if p_data is not null then
  if jsonb_typeof(p_data)<>'object' or length(p_data::text)>16000 then raise exception 'invalid_content'; end if;
  row_id:=nullif(p_data->>'id','')::uuid;
  if row_id is null then
   insert into public.charity_public_content(charity_id,kind,title,body,image_url,link_url,donation_type,target_amount,published) values(c,p_data->>'kind',trim(p_data->>'title'),coalesce(p_data->>'body',''),nullif(p_data->>'image_url',''),nullif(p_data->>'link_url',''),nullif(p_data->>'donation_type',''),nullif(p_data->>'target_amount','')::numeric,coalesce((p_data->>'published')::boolean,false)) returning id into row_id;
  else
   update public.charity_public_content set kind=p_data->>'kind',title=trim(p_data->>'title'),body=coalesce(p_data->>'body',''),image_url=nullif(p_data->>'image_url',''),link_url=nullif(p_data->>'link_url',''),donation_type=nullif(p_data->>'donation_type',''),target_amount=nullif(p_data->>'target_amount','')::numeric,published=coalesce((p_data->>'published')::boolean,false),updated_at=now() where id=row_id and charity_id=c;
   if not found then raise exception 'content_not_found'; end if;
  end if;
  perform private.log_audit(c,auth.uid(),'charity.content_saved','charity_public_content',row_id,null,jsonb_build_object('published',p_data->>'published'));
 end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.charity_public_content x where charity_id=c),'[]'::jsonb);
end $$;

create or replace function public.public_charity_site(p_charity_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('charity',jsonb_build_object('id',c.id,'charity_code',c.charity_code,'name_ar',c.name_ar,'city',c.city,'region',c.region,'description_ar',c.description_ar,'logo_url',c.logo_url),'site',to_jsonb(s)-'charity_id','updates',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'title',u.title_ar,'body',u.body_ar,'image_url',u.image_url,'published_at',u.published_at) order by u.published_at desc) from (select * from public.charity_updates where charity_id=c.id and status='published' order by published_at desc limit 30)u),'[]'::jsonb),'content',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'title',x.title,'body',x.body,'image_url',x.image_url,'link_url',x.link_url,'donation_type',x.donation_type,'target_amount',x.target_amount) order by x.created_at desc) from public.charity_public_content x where x.charity_id=c.id and x.published),'[]'::jsonb))
 from public.charities c join public.charity_public_sites s on s.charity_id=c.id where c.id=p_charity_id and c.status='approved' and s.published and exists(select 1 from public.charity_subscriptions t where t.charity_id=c.id and t.status in('trial','active') and t.starts_at<=now() and (t.ends_at is null or t.ends_at>now()));
$$;
revoke all on function public.accept_member_invitation(text),public.accept_team_invitation(text),public.accept_staff_invitation(text,text),public.team_center(),public.revoke_staff_invitation(uuid),public.manage_public_content(jsonb) from public,anon;
grant execute on function public.accept_member_invitation(text),public.accept_team_invitation(text),public.accept_staff_invitation(text,text),public.team_center(),public.revoke_staff_invitation(uuid),public.manage_public_content(jsonb) to authenticated;

create or replace function public.create_member_invitation(p_email text,p_role_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=private.current_charity_id(); r public.roles%rowtype; token text; i uuid; expiry timestamptz:=now()+interval '7 days';
begin
 if auth.uid() is null or c is null or not private.has_permission('team.manage') then raise exception 'forbidden'; end if;
 if p_email is null or length(p_email)>254 or trim(p_email)!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email'; end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text||lower(trim(p_email)),0));
 select * into r from public.roles where id=p_role_id and (charity_id=c or (charity_id is null and is_system));
 if not found or r.code='owner' then raise exception 'invalid_role'; end if;
 if exists(select 1 from public.charity_members m join auth.users u on u.id=m.user_id where m.charity_id=c and lower(u.email)=lower(trim(p_email))) then raise exception 'user_already_member'; end if;
 if exists(select 1 from public.member_invitations where charity_id=c and lower(email)=lower(trim(p_email)) and accepted_at is null and revoked_at is null and expires_at>now()) then raise exception 'active_invitation_exists'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.member_invitations(charity_id,email,role_id,token_hash,invited_by,expires_at) values(c,lower(trim(p_email)),p_role_id,encode(extensions.digest(token,'sha256'),'hex'),auth.uid(),expiry) returning id into i;
 perform private.log_audit(c,auth.uid(),'team.invitation_created','member_invitation',i,null,jsonb_build_object('role',r.code));
 return jsonb_build_object('invitation_id',i,'token',token,'expires_at',expiry,'charity_code',(select charity_code from public.charities where id=c));
end $$;
