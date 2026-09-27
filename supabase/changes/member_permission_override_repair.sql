-- Permission override consistency and role-language review
-- Aligns the UI/RPC contract with the database constraint, adds an explicit
-- "inherit from role" operation, and fixes the donor-manager permission gap.

alter table public.user_permission_overrides
  drop constraint if exists user_permission_overrides_effect_check;

alter table public.user_permission_overrides
  add constraint user_permission_overrides_effect_check
  check (effect in ('allow','deny'));

create or replace function public.clear_member_permission(p_member_id uuid,p_permission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 c uuid;
 target public.charity_members%rowtype;
 perm public.permissions%rowtype;
 previous_effect text;
begin
 c:=private.current_charity_id();
 if c is null or not private.has_permission('team.manage') then raise exception 'permission_denied'; end if;

 select * into target
 from public.charity_members
 where id=p_member_id and charity_id=c and status='active';
 if not found then raise exception 'member_not_found'; end if;
 if target.user_id=auth.uid() then raise exception 'cannot_change_own_permissions'; end if;

 select * into perm from public.permissions where id=p_permission_id;
 if not found then raise exception 'permission_not_found'; end if;

 select effect into previous_effect
 from public.user_permission_overrides
 where charity_member_id=p_member_id and permission_id=p_permission_id;

 delete from public.user_permission_overrides
 where charity_member_id=p_member_id and permission_id=p_permission_id;

 perform private.log_audit(
  c,auth.uid(),'team.permission_override_cleared','charity_member',p_member_id,
  case when previous_effect is null then null else jsonb_build_object('permission',perm.code,'effect',previous_effect) end,
  jsonb_build_object('permission',perm.code,'effect','inherit')
 );

 return jsonb_build_object('member_id',p_member_id,'permission',perm.code,'effect','inherit');
end
$function$;

revoke execute on function public.clear_member_permission(uuid,uuid) from public,anon;
grant execute on function public.clear_member_permission(uuid,uuid) to authenticated;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.code='donors.manage'
where r.code='donor_manager' and r.is_system=true
on conflict do nothing;

update public.roles set name_ar=case code
 when 'admin' then 'مدير الجمعية'
 when 'case_manager' then 'مسؤول الحالات والدعم'
 when 'content_manager' then 'مسؤول المحتوى'
 when 'donor_manager' then 'مسؤول المتبرعين والتبرعات'
 when 'finance' then 'المحاسبة والمالية'
 else name_ar end
where is_system=true and code in('admin','case_manager','content_manager','donor_manager','finance');

update public.permissions set name_ar=case code
 when 'members.manage' then 'إدارة أعضاء الفريق'
 when 'onboarding.manage' then 'إدارة إعدادات الجمعية'
 when 'support.approve' then 'اعتماد المساعدات'
 when 'support.manage' then 'إدارة المساعدات'
 when 'updates.manage' then 'إدارة المركز الإعلامي'
 else name_ar end
where code in('members.manage','onboarding.manage','support.approve','support.manage','updates.manage');
