import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      'components/tables/data-table.tsx',
      'components/departments/create-department-modal.tsx',
      'components/departments/edit-department-modal.tsx',
      'components/layout/app-shell.tsx',
      'components/tour/tour-provider.tsx',
      'components/daily-log/time-input.tsx',
      'features/dashboard/queries.ts',
      'lib/daily-log/time-tracking-v2.ts',
      'lib/supabase/types.ts',
      'scripts/audit-tenant-integrity.ts',
      'scripts/backfill-calculated-metrics.ts',
      'scripts/recalc-worker.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default config
