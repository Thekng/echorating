import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { getLeaderboard } from '@/features/leaderboard/queries'

export async function GET(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ success: false, error: 'Missing service key' }, { status: 500 })
    }

    const url = new URL(req.url)
    const departmentId = url.searchParams.get('departmentId')
    const metricId = url.searchParams.get('metricId')
    const period = url.searchParams.get('period') as 'today' | 'current_week' | 'this_week' | 'this_month' | 'custom' | null
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined

    const supabase = await createClient()
    const admin = createAdminClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        {
          success: false,
          error: profileError ? formatDatabaseError(profileError.message) : 'Profile not found',
        },
        { status: 400 },
      )
    }

    const companyId = profile.company_id as string
    const [departmentsResult, leaderboardResult] = await Promise.all([
      admin
        .from('departments')
        .select('department_id, name')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name', { ascending: true }),
      getLeaderboard({ departmentId, metricId, period, startDate, endDate, limit }),
    ])

    if (departmentsResult.error) {
      return NextResponse.json(
        { success: false, error: formatDatabaseError(departmentsResult.error.message) },
        { status: 400 },
      )
    }

    if (!leaderboardResult.success) {
      const departments = departmentsResult.data ?? []
      const fallbackDepartmentId = departmentId ?? departments[0]?.department_id ?? ''
      const normalizedPeriod = period === 'this_week' ? 'current_week' : (period ?? 'today')

      return NextResponse.json({
        success: true,
        data: {
          departments,
          leaderboard: [],
          departmentId: fallbackDepartmentId,
          metricId: 'department_score',
          sortOptions: [
            {
              metric_id: 'department_score',
              name: 'Department Score',
              code: 'department_score',
              data_type: 'percent',
              unit: '%',
            },
          ],
          selectedMetric: {
            metric_id: 'department_score',
            name: 'Department Score',
            code: 'department_score',
            data_type: 'percent',
            unit: '%',
          },
          period: normalizedPeriod,
          startDate: '',
          endDate: '',
          scoringMetricsCount: 0,
          message: leaderboardResult.error,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...leaderboardResult.data,
        departments: departmentsResult.data ?? [],
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
