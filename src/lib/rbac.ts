import { supabase } from '../supabase';

export type Permission = { code: string; name_ar: string; name_en: string };
export type AccessState = { charityId: string | null; memberId: string | null; roleCode: string | null; permissions: string[] };

export async function getAccessState(): Promise<AccessState> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { charityId: null, memberId: null, roleCode: null, permissions: [] };
  const { data } = await supabase.from('charity_members').select('id,charity_id,role_id,roles(code,role_permissions(permissions(code)))').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
  if (!data) return { charityId: null, memberId: null, roleCode: null, permissions: [] };
  const role = Array.isArray(data.roles) ? data.roles[0] : data.roles as any;
  const inherited = (role?.role_permissions || []).map((x: any) => Array.isArray(x.permissions) ? x.permissions[0]?.code : x.permissions?.code).filter(Boolean);
  const { data: overrides } = await supabase.from('user_permission_overrides').select('effect,permissions(code)').eq('charity_member_id', data.id);
  const denied = new Set((overrides || []).filter((x: any) => x.effect === 'deny').map((x: any) => Array.isArray(x.permissions) ? x.permissions[0]?.code : x.permissions?.code).filter(Boolean));
  const allowed = (overrides || []).filter((x: any) => x.effect === 'allow').map((x: any) => Array.isArray(x.permissions) ? x.permissions[0]?.code : x.permissions?.code).filter(Boolean);
  return { charityId: data.charity_id, memberId: data.id, roleCode: role?.code || null, permissions: [...new Set([...inherited, ...allowed].filter(x => !denied.has(x)))] };
}

export function can(access: AccessState, permission: string) { return access.permissions.includes(permission); }
