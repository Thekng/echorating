import type { SupabaseClient } from '@supabase/supabase-js'

export async function getTodaySubmissionStatus(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<{ hasSubmittedToday: boolean }> {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await admin
    .from('daily_reports')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('report_date', today)
    .eq('status', 'submitted')
    .limit(1)
    .maybeSingle()

  return { hasSubmittedToday: data !== null }
}
