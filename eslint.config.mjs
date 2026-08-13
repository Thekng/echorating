import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      'components/auth/select-company-form.tsx',
      'components/daily-log/time-input.tsx',
      'components/tables/data-table.tsx',
      'lib/daily-log/time-tracking-v2.ts',
      'scripts/**',
      'features/**',
      'app/(app)/settings/metrics/page.tsx',
      'components/agents/agents-filters.tsx',
      'components/departments/create-department-modal.tsx',
      'components/departments/edit-department-modal.tsx',
      'components/layout/app-shell.tsx',
      'components/tour/tour-provider.tsx',
      'lib/supabase/types.ts',
      'app/(app)/settings/departments/page.tsx',
      'app/(app)/settings/members/page.tsx',
      'app/(app)/dashboard/error.tsx',
      'app/error.tsx',
      'app/global-error.tsx',
      'components/daily-log/daily-log-form.tsx',
      'components/layout/nav-items.ts',
      'components/metrics/metrics-search.tsx',
      'lib/actions/wrap-action.ts',
      'lib/supabase/session-claims.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default config
