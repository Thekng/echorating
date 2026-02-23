import { CompanySettingsForm } from '@/components/company/company-settings-form'
import { toggleCompanyStatusAction } from '@/features/company/actions'
import { getCompanyDetails } from '@/features/company/queries'
import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsError } from '@/components/settings/settings-error'
import { SettingsChip } from '@/components/settings/settings-chip'

export default async function CompanySettingsPage() {
  const result = await getCompanyDetails()

  if (!result.success || !result.data) {
    return <SettingsError error={result.error || 'Failed to load company details'} />
  }

  const { company, role, profileName } = result.data
  const canEdit = role === 'owner'

  return (
    <div className="space-y-5">
      <SettingsPageHeader
        title="Company"
        description="Manage organization profile details and account state."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CompanySettingsForm name={company.name} timezone={company.timezone} canEdit={canEdit} />
        </div>

        <aside className="space-y-4">
          <SettingsSurface>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Access
            </h3>
            <p className="mt-2 text-sm">
              Logged as <span className="font-medium">{profileName}</span>
            </p>
            <div className="mt-3">
              <SettingsChip tone={role === 'owner' ? 'success' : 'info'}>{role}</SettingsChip>
            </div>
          </SettingsSurface>

          <SettingsSurface>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Company Status
            </h3>
            <div className="mt-2">
              <SettingsChip tone={company.is_active ? 'success' : 'neutral'}>
                {company.is_active ? 'Active' : 'Inactive'}
              </SettingsChip>
            </div>

            {canEdit ? (
              <form action={toggleCompanyStatusAction} className="mt-4">
                <input type="hidden" name="nextStatus" value={company.is_active ? 'inactive' : 'active'} />
                <button
                  type="submit"
                  className="h-9 rounded-md border border-input px-3 text-sm hover:bg-muted/40"
                >
                  {company.is_active ? 'Deactivate company' : 'Activate company'}
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Only owners can change company status.</p>
            )}
          </SettingsSurface>
        </aside>
      </div>
    </div>
  )
}
