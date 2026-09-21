import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'app/**',
      'components/agents/agents-filters.tsx',
      'components/auth/select-company-form.tsx',
      'components/daily-log/daily-log-form.tsx',
      'components/daily-log/time-input.tsx',
      'components/departments/create-department-modal.tsx',
      'components/departments/edit-department-modal.tsx',
      'components/layout/app-shell.tsx',
      'components/layout/nav-items.ts',
      'components/tables/data-table.tsx',
      'components/tour/tour-provider.tsx',
      'features/**',
      'lib/actions/wrap-action.ts',
      'lib/daily-log/time-tracking-v2.ts',
      'lib/supabase/session-claims.ts',
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
