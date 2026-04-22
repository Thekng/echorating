import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/features/leaderboard/queries'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const departmentId = url.searchParams.get('departmentId')
    const metricId = url.searchParams.get('metricId')
    const period = url.searchParams.get('period') as 'today' | 'yesterday' | 'current_week' | 'this_week' | 'this_month' | 'last_week' | 'last_month' | 'custom' | null
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined

    const result = await getLeaderboard({
      departmentId,
      metricId,
      period,
      startDate,
      endDate,
      limit,
    })

    if (!result.success) {
      const isAuthError = /authentication|required|insufficient permissions/i.test(result.error)
      return NextResponse.json(
        { success: false, error: result.error },
        { status: isAuthError ? 401 : 400 },
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error: unknown) {
    console.error('[API_ERROR] /api/leaderboard:', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

