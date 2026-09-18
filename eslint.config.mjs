import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const eslintConfig = [
  {
    ignores: [
      '.next/',
      'node_modules/',
      'app/(app)/settings/',
      'components/agents/agents-filters.tsx',
      'components/departments/create-department-modal.tsx',
      'components/departments/edit-department-modal.tsx',
      'components/layout/app-shell.tsx',
      'components/tour/tour-provider.tsx',
      'components/tables/data-table.tsx',
      'lib/daily-log/time-tracking-v2.ts',
      'lib/supabase/types.ts',
      'scripts/audit-tenant-integrity.ts',
      'scripts/backfill-calculated-metrics.ts',
      'scripts/recalc-worker.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]

export default eslintConfig
