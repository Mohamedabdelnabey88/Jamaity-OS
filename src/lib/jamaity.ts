import { supabase } from '../supabase'

export type Charity = {
  id: string
  name_ar: string
  name_en: string | null
  slug: string
  city: string | null
  region: string | null
  description_ar: string | null
  logo_url: string | null
  status: string
  verified_at: string | null
}

export type Beneficiary = {
  id: string
  charity_id: string
  full_name: string
  phone: string | null
  national_id_hash: string | null
  status: string
  created_at: string
  updated_at: string
}

export async function getMyCharity() {
  const { data: userResult } = await supabase.auth.getUser()
  const user = userResult.user
  if (!user) return null
  const { data, error } = await supabase
    .from('charity_members')
    .select('charity_id, charities(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.charities as unknown as Charity | null) ?? null
}

export async function getBeneficiaries(charityId: string, search = '') {
  let query = supabase
    .from('beneficiaries')
    .select('id,charity_id,full_name,phone,national_id_hash,status,created_at,updated_at', { count: 'exact' })
    .eq('charity_id', charityId)
    .order('created_at', { ascending: false })
    .range(0, 49)
  if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)
  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as Beneficiary[], count: count ?? 0 }
}

export async function getDashboardStats(charityId: string) {
  const [beneficiaries, cases, donations, support] = await Promise.all([
    supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('charity_id', charityId),
    supabase.from('cases').select('*', { count: 'exact', head: true }).eq('charity_id', charityId).in('status', ['new', 'under_review']),
    supabase.from('donations').select('amount').eq('charity_id', charityId).eq('status', 'received'),
    supabase.from('support_records').select('amount').eq('charity_id', charityId).eq('status', 'approved'),
  ])
  if (beneficiaries.error) throw beneficiaries.error
  if (cases.error) throw cases.error
  if (donations.error) throw donations.error
  if (support.error) throw support.error
  const sum = (rows: { amount: number | null }[] | null) => (rows ?? []).reduce((n, r) => n + Number(r.amount ?? 0), 0)
  return { beneficiaries: beneficiaries.count ?? 0, openCases: cases.count ?? 0, donations: sum(donations.data), support: sum(support.data) }
}
