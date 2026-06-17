'use client'

import Link from 'next/link'
import {
  type DashboardResultData,
  type DashboardTopPerformer,
  type DashboardActivityItem,
} from '@/features/dashboard/queries'
import { DashboardFilters } from './dashboard-filters'
import { DashboardInteractive } from './dashboard-interactive'
import { AnalyticsLineChart } from '@/components/charts/analytics-line-chart'
import { ScoreCard } from '@/components/shared/score-card'
import { StatCard } from '@/components/shared/stat-card'
import { SectionHeader } from '@/components/shared/section-header'
import {
  DataTable,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableRow,
  DataTableCell,
} from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Send,
  CalendarCheck,
  TrendingUp,
  Users,
  Activity,
  AlertTriangle,
  Hash,
} from 'lucide-react'
import { hasPermission } from '@/lib/rbac/roles'
import { ROUTES } from '@/lib/constants/routes'

type DashboardViewProps = {
  data: DashboardResultData
  selectedMetricId?: string
  hasSubmittedToday?: boolean
}

function formatDateShort(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function DashboardView({ data, selectedMetricId, hasSubmittedToday }: DashboardViewProps) {
  const isManagerView = hasPermission(data.viewerRole, 'manager')
  const hasKpis = data.kpis.length > 0
  const hasSeries = data.series.length > 0

  return (
    <div className="space-y-5">
      {/* Submission Reminder Banner (members only) */}
      {!isManagerView && hasSubmittedToday === false && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            You haven&apos;t submitted today&apos;s log yet.
          </p>
          <Link
            href={ROUTES.DAILY_LOG}
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            Submit now
          </Link>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isManagerView ? 'Dashboard' : 'Your Performance'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Performance overview · {formatDateShort(data.startDate)} – {formatDateShort(data.endDate)}
        </p>
      </div>

      {/* Filters */}
      <DashboardFilters
        departments={data.departments}
        selectedDepartmentId={data.selectedDepartmentId}
        agents={isManagerView ? data.agents : undefined}
        selectedUserId={data.selectedUserId}
        period={data.period}
        startDate={data.startDate}
        endDate={data.endDate}
      />

      {/* Score Overview Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreCard
          title={isManagerView ? 'Agency Score' : 'Your Score'}
          score={data.agencyScore.score}
          subtitle={
            data.agencyScore.score !== null
              ? `Completion ${data.agencyScore.completion_score.toFixed(0)}% · Target ${data.agencyScore.target_score.toFixed(0)}%`
              : undefined
          }
        />
        <StatCard
          title="Submission Rate"
          value={`${data.stats.submission_rate.toFixed(1)}%`}
          icon={<Send className="h-4 w-4" />}
          progress={data.stats.submission_rate}
        />
        <StatCard
          title="Consistency"
          value={`${data.stats.consistency_rate.toFixed(1)}%`}
          icon={<CalendarCheck className="h-4 w-4" />}
          progress={data.stats.consistency_rate}
        />
        {isManagerView ? (
          data.forecast ? (
            <StatCard
              title="Forecast"
              value={data.forecast.projected_value?.toLocaleString() ?? '--'}
              icon={<TrendingUp className="h-4 w-4" />}
              target={data.forecast.target_value ? Number(data.forecast.target_value.toLocaleString()) : undefined}
              progress={data.forecast.projected_achievement}
            />
          ) : (
            <StatCard
              title="Active Members"
              value={data.stats.active_agents}
              icon={<Users className="h-4 w-4" />}
            />
          )
        ) : (
          <StatCard
            title="Your Rank"
            value={data.viewerRank ? `#${data.viewerRank}` : '--'}
            icon={<Hash className="h-4 w-4" />}
          />
        )}
      </div>

      {/* KPI Cards */}
      {hasKpis && (
        <DashboardInteractive
          kpis={data.kpis}
          submittedLogs={data.stats.submitted_logs}
          paceTotalUnits={data.paceTotalUnits}
          paceElapsedUnits={data.paceElapsedUnits}
          paceUnitLabel={data.paceUnitLabel}
          selectedMetricId={selectedMetricId}
        />
      )}

      {/* Member Targets Progress */}
      {!isManagerView && data.targets.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Your Targets"
            description="Progress toward your current period targets"
          />
          <Card>
            <CardContent className="space-y-4 p-4">
              {data.targets.map((target) => (
                <div key={target.metricName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{target.metricName}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {target.currentValue.toLocaleString()} / {target.targetValue.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={target.progressPct} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Chart */}
      {hasSeries && (
        <AnalyticsLineChart
          series={data.series}
          startDate={data.startDate}
          endDate={data.endDate}
          title="Performance Trend"
          subtitle={data.primaryMetricLabel ? `Primary: ${data.primaryMetricLabel}` : undefined}
        />
      )}

      {/* Top Performers + Recent Log */}
      {isManagerView && (data.topPerformers.length > 0 || data.recentActivity.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Top Performers */}
          {data.topPerformers.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                title="Top Performers"
                description="Ranked by submission consistency"
              />
              <TopPerformersTable performers={data.topPerformers} />
            </div>
          )}

          {/* Recent Log */}
          {data.recentActivity.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                title="Recent Log"
                description="Latest submissions"
              />
              <ActivityFeed items={data.recentActivity} />
            </div>
          )}
        </div>
      )}

      {/* Recent Log (non-manager view) */}
      {!isManagerView && data.recentActivity.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Recent Log"
            description="Latest submissions"
          />
          <ActivityFeed items={data.recentActivity} />
        </div>
      )}

      {/* Empty state if nothing to show */}
      {!hasKpis && !hasSeries && data.topPerformers.length === 0 && (
        <EmptyState
          title="No data yet"
          description="Start submitting daily logs to see your performance dashboard."
        />
      )}
    </div>
  )
}

function TopPerformersTable({ performers }: { performers: DashboardTopPerformer[] }) {
  return (
    <DataTable>
      <DataTableHeader>
        <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
        <DataTableHeaderCell>Name</DataTableHeaderCell>
        <DataTableHeaderCell align="right">Score</DataTableHeaderCell>
      </DataTableHeader>
      <tbody>
        {performers.map((performer) => (
          <DataTableRow key={performer.user_id}>
            <DataTableCell className="w-12">
              {performer.rank <= 3 ? (
                <span className="text-base">
                  {performer.rank === 1 ? '🥇' : performer.rank === 2 ? '🥈' : '🥉'}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{performer.rank}</span>
              )}
            </DataTableCell>
            <DataTableCell>
              <p className="text-sm font-medium">{performer.name}</p>
              <p className="text-[11px] text-muted-foreground">{performer.department}</p>
            </DataTableCell>
            <DataTableCell align="right">
              <span className="text-sm font-semibold tabular-nums">
                {performer.score.toFixed(0)}
              </span>
              <span className="text-[11px] text-muted-foreground ml-0.5">%</span>
            </DataTableCell>
          </DataTableRow>
        ))}
      </tbody>
    </DataTable>
  )
}

function ActivityFeed({ items }: { items: DashboardActivityItem[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {items.slice(0, 10).map((item, index) => (
            <li key={`${item.user_id}-${item.timestamp}-${index}`} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Activity className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{item.name}</span>{' '}
                  <span className="text-muted-foreground">{item.action}</span>
                </p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {formatDateShort(item.timestamp)}
              </time>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
