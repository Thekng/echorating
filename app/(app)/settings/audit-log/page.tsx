import { SettingsHeader } from '@/components/settings/settings-header'
import { AuditLogTable } from '@/components/settings/audit-log-table'

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Audit Log"
        description="View a history of actions taken in your organization."
      />
      <AuditLogTable />
    </div>
  )
}
