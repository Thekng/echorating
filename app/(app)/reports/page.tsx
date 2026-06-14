import { PageShell } from '@/components/layout/page-shell'
import { EmptyState } from '@/components/shared/empty-state'
import { BarChart3 } from 'lucide-react'

export default function ReportsPage() {
  return (
    <PageShell
      title="Reports"
      subtitle="Analyze agency performance, trends, and team insights."
    >
      <EmptyState
        icon={<BarChart3 className="h-5 w-5" />}
        title="Reports coming soon"
        description="Weekly summaries, monthly performance reports, department comparisons, and exportable analytics are on the way."
      />
    </PageShell>
  )
}
