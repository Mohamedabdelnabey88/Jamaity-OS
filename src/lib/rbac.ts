import { supabase } from '../supabase';

export type Permission = { code: string; name_ar: string; name_en: string };
export type AccessState = {
  charityId: string | null;
  workspaceCharityId: string | null;
  workspaceEnabled: boolean;
  memberId: string | null;
  roleCode: string | null;
  permissions: string[];
  charityStatus: string | null;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
};

export async function getAccessState(): Promise<AccessState> {
  const fallback: AccessState = { charityId: null, workspaceCharityId: null, workspaceEnabled: false, memberId: null, roleCode: null, permissions: [], charityStatus: null, subscriptionStatus: null, subscriptionEndsAt: null };
  const { data, error } = await supabase.rpc('current_access_state');
  if (error || !data) return fallback;
  const x = data as any;
  return {
    charityId: x.charity_id ?? null,
    workspaceCharityId: x.workspace_charity_id ?? null,
    workspaceEnabled: Boolean(x.workspace_enabled),
    memberId: x.member_id ?? null,
    roleCode: x.role_code ?? null,
    permissions: Array.isArray(x.permissions) ? x.permissions : [],
    charityStatus: x.charity_status ?? null,
    subscriptionStatus: x.subscription_status ?? null,
    subscriptionEndsAt: x.subscription_ends_at ?? null,
  };
}

export function can(access: AccessState, permission: string) {
  return access.permissions.includes(permission);
}
