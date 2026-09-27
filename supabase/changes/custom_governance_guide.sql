-- Per-charity customizable governance guide.
alter table public.governance_requirements
  add column if not exists is_active boolean not null default true,
  add column if not exists evidence_policy text not null default 'required',
  add column if not exists source_kind text not null default 'system',
  add column if not exists sort_order integer not null default 100;

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.governance_requirements'::regclass and conname='governance_requirements_evidence_policy_check') then
    alter table public.governance_requirements
      add constraint governance_requirements_evidence_policy_check
      check (evidence_policy in ('required','optional','none'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.governance_requirements'::regclass and conname='governance_requirements_source_kind_check') then
    alter table public.governance_requirements
      add constraint governance_requirements_source_kind_check
      check (source_kind in ('system','custom'));
  end if;
end $$;

with ranked as (
  select id,row_number() over(partition by charity_id order by category,title_ar,id) * 10 as n
  from public.governance_requirements
)
update public.governance_requirements g
set sort_order=ranked.n
from ranked
where ranked.id=g.id and g.sort_order=100;

create or replace function public.governance_center()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 c uuid; items jsonb; total int; ready_count int; overdue_count int; inactive_count int; owner_can_customize boolean;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 c:=private.current_charity_id();
 if c is null or not (private.has_permission('governance.view') or private.has_permission('governance.manage')) then raise exception 'forbidden'; end if;
 perform private.ensure_governance_requirements(c);

 select exists(
   select 1 from public.charity_members cm
   join public.roles r on r.id=cm.role_id
   where cm.charity_id=c and cm.user_id=auth.uid() and cm.status='active' and r.code='owner'
 ) into owner_can_customize;

 select count(*),count(*) filter(where status='ready'),
        count(*) filter(where due_date<current_date and status not in ('ready','not_applicable'))
 into total,ready_count,overdue_count
 from public.governance_requirements
 where charity_id=c and is_active=true and status<>'not_applicable';

 select count(*) into inactive_count from public.governance_requirements where charity_id=c and is_active=false;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',g.id,'code',g.code,'category',g.category,'title_ar',g.title_ar,'description_ar',g.description_ar,
   'status',g.status,'due_date',g.due_date,'completed_at',g.completed_at,'evidence_policy',g.evidence_policy,
   'source_kind',g.source_kind,'sort_order',g.sort_order,
   'evidence_count',(select count(*) from public.governance_evidence e where e.requirement_id=g.id and e.charity_id=c),
   'evidence',(select coalesce(jsonb_agg(jsonb_build_object(
     'id',e.id,'title_ar',e.title_ar,'object_path',e.object_path,'expires_at',e.expires_at,'created_at',e.created_at
   ) order by e.created_at desc),'[]'::jsonb) from public.governance_evidence e where e.requirement_id=g.id and e.charity_id=c)
 ) order by g.sort_order,g.category,g.title_ar),'[]'::jsonb)
 into items
 from public.governance_requirements g
 where g.charity_id=c and g.is_active=true;

 return jsonb_build_object(
   'score',case when total=0 then 100 else round((ready_count::numeric/total)*100) end,
   'ready',ready_count,'total',total,'overdue',overdue_count,'inactive',inactive_count,
   'can_customize',owner_can_customize,'items',items
 );
end
$function$;

create or replace function public.governance_requirement_catalog()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare c uuid:=private.current_charity_id(); result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not exists(
   select 1 from public.charity_members cm
   join public.roles r on r.id=cm.role_id
   where cm.charity_id=c and cm.user_id=auth.uid() and cm.status='active' and r.code='owner'
 ) then raise exception 'owner_required'; end if;

 perform private.ensure_governance_requirements(c);

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',g.id,'code',g.code,'category',g.category,'title_ar',g.title_ar,'description_ar',g.description_ar,
   'status',g.status,'due_date',g.due_date,'is_active',g.is_active,'evidence_policy',g.evidence_policy,
   'source_kind',g.source_kind,'sort_order',g.sort_order,
   'evidence_count',(select count(*) from public.governance_evidence e where e.requirement_id=g.id and e.charity_id=c)
 ) order by g.sort_order,g.category,g.title_ar),'[]'::jsonb)
 into result
 from public.governance_requirements g
 where g.charity_id=c;

 return result;
end
$function$;

create or replace function public.save_governance_requirement(
 p_requirement_id uuid,p_category text,p_title_ar text,p_description_ar text,
 p_evidence_policy text,p_due_date date,p_is_active boolean,p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare c uuid:=private.current_charity_id(); r public.governance_requirements%rowtype; old jsonb; code_value text;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not exists(
   select 1 from public.charity_members cm
   join public.roles ro on ro.id=cm.role_id
   where cm.charity_id=c and cm.user_id=auth.uid() and cm.status='active' and ro.code='owner'
 ) then raise exception 'owner_required'; end if;

 if nullif(trim(coalesce(p_category,'')),'') is null then raise exception 'category_required'; end if;
 if nullif(trim(coalesce(p_title_ar,'')),'') is null then raise exception 'title_required'; end if;
 if length(trim(p_title_ar))>180 then raise exception 'title_too_long'; end if;
 if length(coalesce(p_description_ar,''))>1500 then raise exception 'description_too_long'; end if;
 if p_evidence_policy not in ('required','optional','none') then raise exception 'invalid_evidence_policy'; end if;
 if coalesce(p_sort_order,100) not between 0 and 10000 then raise exception 'invalid_sort_order'; end if;

 if p_requirement_id is null then
   code_value:='custom_'||replace(gen_random_uuid()::text,'-','');
   insert into public.governance_requirements(
     charity_id,code,category,title_ar,description_ar,status,due_date,created_by,updated_by,
     is_active,evidence_policy,source_kind,sort_order
   ) values(
     c,code_value,trim(p_category),trim(p_title_ar),nullif(trim(coalesce(p_description_ar,'')),''),
     'not_started',p_due_date,auth.uid(),auth.uid(),coalesce(p_is_active,true),p_evidence_policy,'custom',coalesce(p_sort_order,100)
   ) returning * into r;
   perform private.log_audit(c,'governance.requirement_created','governance_requirement',r.id,null,to_jsonb(r));
 else
   select * into r from public.governance_requirements where id=p_requirement_id and charity_id=c for update;
   if not found then raise exception 'not_found'; end if;
   old:=to_jsonb(r);
   update public.governance_requirements
   set category=trim(p_category),title_ar=trim(p_title_ar),
       description_ar=nullif(trim(coalesce(p_description_ar,'')),''),
       due_date=p_due_date,is_active=coalesce(p_is_active,true),evidence_policy=p_evidence_policy,
       sort_order=coalesce(p_sort_order,sort_order),updated_by=auth.uid(),updated_at=now()
   where id=p_requirement_id returning * into r;
   perform private.log_audit(c,'governance.requirement_definition_updated','governance_requirement',r.id,old,to_jsonb(r));
 end if;

 return jsonb_build_object(
   'id',r.id,'code',r.code,'category',r.category,'title_ar',r.title_ar,'description_ar',r.description_ar,
   'due_date',r.due_date,'is_active',r.is_active,'evidence_policy',r.evidence_policy,
   'source_kind',r.source_kind,'sort_order',r.sort_order
 );
end
$function$;

create or replace function public.set_governance_requirement_status(
 p_requirement_id uuid,p_status text,p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare c uuid; r public.governance_requirements%rowtype; old jsonb; evidence_total int;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 c:=private.current_charity_id();
 if c is null or not private.has_permission('governance.manage') then raise exception 'forbidden'; end if;
 if p_status not in ('not_started','in_progress','ready','not_applicable') then raise exception 'invalid_status'; end if;

 select * into r from public.governance_requirements
 where id=p_requirement_id and charity_id=c and is_active=true for update;
 if not found then raise exception 'not_found'; end if;

 if p_status='ready' and r.evidence_policy='required' then
   select count(*) into evidence_total from public.governance_evidence where requirement_id=r.id and charity_id=c;
   if evidence_total=0 then raise exception 'evidence_required_before_ready'; end if;
 end if;

 old:=to_jsonb(r);
 update public.governance_requirements
 set status=p_status,due_date=coalesce(p_due_date,due_date),
     completed_at=case when p_status='ready' then coalesce(completed_at,now()) else null end,
     updated_by=auth.uid(),updated_at=now()
 where id=r.id returning * into r;

 perform private.log_audit(c,'governance.requirement_updated','governance_requirement',r.id,old,to_jsonb(r));
 return to_jsonb(r);
end
$function$;

create or replace function public.add_governance_evidence(
 p_requirement_id uuid,p_title_ar text,p_object_path text default null,
 p_expires_at date default null,p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare c uuid; eid uuid; requirement_policy text;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 c:=private.current_charity_id();
 if c is null or not private.has_permission('governance.manage') then raise exception 'forbidden'; end if;

 select evidence_policy into requirement_policy
 from public.governance_requirements
 where id=p_requirement_id and charity_id=c and is_active=true;

 if requirement_policy is null then raise exception 'not_found'; end if;
 if requirement_policy='none' then raise exception 'evidence_not_required'; end if;

 insert into public.governance_evidence(charity_id,requirement_id,title_ar,object_path,expires_at,notes,created_by)
 values(c,p_requirement_id,trim(p_title_ar),nullif(trim(coalesce(p_object_path,'')),''),
        p_expires_at,nullif(trim(coalesce(p_notes,'')),''),auth.uid())
 returning id into eid;

 perform private.log_audit(c,'governance.evidence_added','governance_evidence',eid,null,
   jsonb_build_object('requirement_id',p_requirement_id,'title_ar',p_title_ar));
 return eid;
end
$function$;

revoke execute on function public.governance_requirement_catalog() from public,anon;
grant execute on function public.governance_requirement_catalog() to authenticated;
revoke execute on function public.save_governance_requirement(uuid,text,text,text,text,date,boolean,integer) from public,anon;
grant execute on function public.save_governance_requirement(uuid,text,text,text,text,date,boolean,integer) to authenticated;
