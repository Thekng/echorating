import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/features/leaderboard/queries'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const departmentId = url.searchParams.get('departmentId')
    const metricId = url.searchParams.get('metricId')
    const period = url.searchParams.get('period') as 'today' | 'current_week' | 'this_week' | 'this_month' | 'custom' | null
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

