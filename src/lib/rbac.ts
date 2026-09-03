import { supabase } from '../supabase';

export type Permission = { code: string; name_ar: string; name_en: string };
export type AccessState = {
  charityId: string | null;
  memberId: string | null;
  roleCode: string | null;
  permissions: string[];
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
};

export async function getAccessState(): Promise<AccessState> {
  const fallback: AccessState = { charityId: null, memberId: null, roleCode: null, permissions: [], subscriptionStatus: null, subscriptionEndsAt: null };
  const { data, error } = await supabase.rpc('current_access_state');
  if (error || !data) return fallback;
  const x = data as any;
  return {
    charityId: x.charity_id ?? null,
    memberId: x.member_id ?? null,
    roleCode: x.role_code ?? null,
    permissions: Array.isArray(x.permissions) ? x.permissions : [],
    subscriptionStatus: x.subscription_status ?? null,
    subscriptionEndsAt: x.subscription_ends_at ?? null,
  };
}

export function can(access: AccessState, permission: string) {
  return access.permissions.includes(permission);
}
