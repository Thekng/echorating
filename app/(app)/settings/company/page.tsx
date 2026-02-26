'use client'

import { useState, useEffect } from 'react'
import { SettingsHeader } from '@/components/settings/settings-header'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsError } from '@/components/settings/settings-error'
import { getCompanyDetails } from '@/features/company/queries'
import { updateCompanyAction } from '@/features/company/actions'
import { useActionState } from 'react'

type CompanyActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, formAction] = useActionState(
    updateCompanyAction,
    { status: 'idle', message: '' } as CompanyActionState
  )

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const result = await getCompanyDetails()
        if (result.success && result.data) {
          setCompany(result.data.company)
        } else {
          setError(result.error || 'Failed to load company details')
        }
      } catch (err) {
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchCompany()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Company" description="Loading..." />
        <SettingsSurface>
          <p className="text-sm text-muted-foreground">Loading company details...</p>
        </SettingsSurface>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Company" description="Manage organization profile." />
        <SettingsError error={error} />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Company" description="Manage organization profile." />
        <SettingsError error="Company not found" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Company"
        description="Manage organization profile, timezone, and account status."
      />

      {state.status === 'success' && (
        <SettingsSurface className="bg-green-50 border border-green-200">
          <p className="text-sm text-green-800">{state.message}</p>
        </SettingsSurface>
      )}

      {state.status === 'error' && (
        <SettingsSurface className="bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{state.message}</p>
        </SettingsSurface>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <form action={formAction}>
            <SettingsSurface>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Company Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    placeholder="Enter company name"
                    defaultValue={company.name}
                    required
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Used in reports and team invitations</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="timezone" className="text-sm font-medium">
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    name="timezone"
                    defaultValue={company.timezone}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="America/Anchorage">Alaska</option>
                    <option value="Pacific/Honolulu">Hawaii</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Europe/Berlin">Berlin</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                    <option value="Asia/Hong_Kong">Hong Kong</option>
                    <option value="Asia/Shanghai">Shanghai</option>
                    <option value="Asia/Singapore">Singapore</option>
                    <option value="Australia/Sydney">Sydney</option>
                    <option value="Australia/Melbourne">Melbourne</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Used for daily reset times and reporting periods</p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </SettingsSurface>
          </form>
        </div>

        <aside className="space-y-4">
          <SettingsSurface>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Status
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">
                  {company.is_active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-yellow-600">Inactive</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {new Date(company.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-medium">
                  {new Date(company.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </SettingsSurface>
        </aside>
      </div>
    </div>
  )
}
