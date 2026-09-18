-- Shared system roles are immutable from a charity workspace.
create or replace function public.set_role_permission(p_role_id uuid,p_permission_id uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid;r public.roles%rowtype;
begin
 c:=private.current_charity_id();
 if auth.uid() is null or c is null or not private.can_manage_roles(c) then raise exception 'permission_denied';end if;
 select * into r from public.roles where id=p_role_id and (charity_id=c or (charity_id is null and is_system=true));
 if not found then raise exception 'role_not_found';end if;
 if r.is_system or r.charity_id is null then raise exception 'system_role_read_only';end if;
 if not exists(select 1 from public.permissions where id=p_permission_id) then raise exception 'permission_not_found';end if;
 if p_enabled then insert into public.role_permissions(role_id,permission_id) values(p_role_id,p_permission_id) on conflict do nothing;
 else delete from public.role_permissions where role_id=p_role_id and permission_id=p_permission_id;end if;
 perform private.log_audit(c,auth.uid(),'role.permission_changed','role',p_role_id,null,jsonb_build_object('permission_id',p_permission_id,'enabled',p_enabled));
 return jsonb_build_object('role_id',p_role_id,'permission_id',p_permission_id,'enabled',p_enabled);
end $$;
revoke all on function public.set_role_permission(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_role_permission(uuid,uuid,boolean) to authenticated;
