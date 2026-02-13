import Link from 'next/link'

export function Sidebar() {
  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b">
        <h2 className="font-bold text-lg">EchoRating</h2>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/daily-log">Daily Log</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/agents">Agents</Link>
        <Link href="/settings">Settings</Link>
      </nav>
    </div>
  )
}
