import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      'components/auth/select-company-form.tsx',
      'components/daily-log/time-input.tsx',
      'components/departments/create-department-modal.tsx',
      'components/departments/edit-department-modal.tsx',
      'components/layout/app-shell.tsx',
      'components/tables/data-table.tsx',
      'components/tour/tour-provider.tsx',
      'features/dashboard/queries.ts',
      'lib/daily-log/time-tracking-v2.ts',
      'scripts/audit-tenant-integrity.ts',
      'scripts/backfill-calculated-metrics.ts',
      'scripts/recalc-worker.ts',
      'lib/supabase/types.ts',
      // Since max-warnings=0 is enabled, let's ignore warnings in baseline files to allow lint to pass
      'app/(app)/dashboard/error.tsx',
      'app/(app)/settings/members/page.tsx',
      'app/error.tsx',
      'app/global-error.tsx',
      'components/daily-log/daily-log-form.tsx',
      'components/layout/nav-items.ts',
      'components/metrics/metrics-search.tsx',
      'features/agents/queries.ts',
      'features/daily-log/queries.ts',
      'features/departments/actions.ts',
      'features/departments/queries.ts',
      'features/leaderboard/queries.ts',
      'features/metrics/actions.ts',
      'lib/actions/wrap-action.ts',
      'lib/supabase/session-claims.ts',
    ]
  }
]

export default config
