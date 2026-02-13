import { CompanySettingsForm } from '@/components/company/company-settings-form'
import { toggleCompanyStatusAction } from '@/features/company/actions'
import { getCompanyDetails } from '@/features/company/queries'
import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsSurface } from '@/components/settings/settings-surface'

export default async function CompanySettingsPage() {
  const result = await getCompanyDetails()

  if (!result.success || !result.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {result.error}
      </div>
    )
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
          <p className="text-sm text-muted-foreground">
            Role: <span className="font-medium">{role}</span>
          </p>
        </SettingsSurface>

        <SettingsSurface>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Company Status
          </h3>
          <p className="mt-2 text-sm">
            Current status:{' '}
            <span className={company.is_active ? 'font-medium text-emerald-600' : 'font-medium text-zinc-500'}>
              {company.is_active ? 'Active' : 'Inactive'}
            </span>
          </p>

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
