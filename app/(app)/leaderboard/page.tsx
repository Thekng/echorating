import LeaderboardClient from '@/components/leaderboard/leaderboard-client'

export default function LeaderboardPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Track and compare agent performance metrics.</p>
      </div>
      <LeaderboardClient />
    </div>
  )
}
