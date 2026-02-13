import Link from 'next/link'

export function MobileNav() {
  return (
    <div className="flex justify-around items-center h-16 bg-background border-t">
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/daily-log">Log</Link>
      <Link href="/leaderboard">Top</Link>
      <Link href="/agents">Agents</Link>
      <Link href="/settings">Settings</Link>
    </div>
  )
}
