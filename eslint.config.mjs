import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      'components/daily-log/time-tracking-v2.ts',
      'lib/daily-log/time-tracking-v2.ts',
      'components/tables/data-table.tsx',
      'components/departments/create-department-modal.tsx',
      'components/departments/edit-department-modal.tsx',
      'components/layout/app-shell.tsx',
      'components/tour/tour-provider.tsx',
      'components/auth/select-company-form.tsx',
      'features/dashboard/queries.ts',
      'scripts/**',
      'lib/supabase/types.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default config
