import LeaderboardClient from '@/components/leaderboard/leaderboard-client'
import { PendingCalculatedBanner } from '@/components/calculated-jobs/pending-banner'
import { getPendingCalculatedCountForViewer } from '@/features/calculated-jobs/queries'

export default async function LeaderboardPage() {
  const pendingCalculatedCount = await getPendingCalculatedCountForViewer()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Track and compare agent performance metrics.</p>
      </div>
      <PendingCalculatedBanner pendingCount={pendingCalculatedCount} />
      <LeaderboardClient />
    </div>
  )
}
