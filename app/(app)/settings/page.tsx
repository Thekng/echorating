import Link from 'next/link'

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Link href="/settings/company">Company</Link>
        <Link href="/settings/departments">Departments</Link>
        <Link href="/settings/members">Members</Link>
        <Link href="/settings/metrics">Metrics</Link>
        <Link href="/settings/targets">Targets</Link>
      </div>
    </div>
  )
}
