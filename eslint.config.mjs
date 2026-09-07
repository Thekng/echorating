import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      'lib/daily-log/time-tracking-v2.ts',
      'components/tables/data-table.tsx',
      'components/tour/tour-provider.tsx',
      'components/departments/**',
      'components/layout/app-shell.tsx',
      'components/auth/select-company-form.tsx',
      'components/agents/agents-filters.tsx',
      'components/daily-log/time-input.tsx',
      'components/daily-log/daily-log-form.tsx',
      'components/metrics/metrics-search.tsx',
      'components/layout/nav-items.ts',
      'app/**',
      'features/**',
      'lib/**',
      'scripts/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default config
