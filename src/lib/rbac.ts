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
  subscriptionRawStatus: string | null;
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  subscriptionRemainingSeconds: number | null;
  trialDays: number | null;
};

export async function getAccessState(): Promise<AccessState> {
  const fallback: AccessState = { charityId: null, workspaceCharityId: null, workspaceEnabled: false, memberId: null, roleCode: null, permissions: [], charityStatus: null, subscriptionStatus: null, subscriptionRawStatus: null, subscriptionStartsAt: null, subscriptionEndsAt: null, subscriptionRemainingSeconds: null, trialDays: null };
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
    subscriptionRawStatus: x.subscription_raw_status ?? null,
    subscriptionStartsAt: x.subscription_starts_at ?? null,
    subscriptionEndsAt: x.subscription_ends_at ?? null,
    subscriptionRemainingSeconds: typeof x.subscription_remaining_seconds === 'number' ? x.subscription_remaining_seconds : null,
    trialDays: typeof x.trial_days === 'number' ? x.trial_days : null,
  };
}

export function can(access: AccessState, permission: string) {
  return access.permissions.includes(permission);
}
