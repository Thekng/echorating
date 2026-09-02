import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      'app/**',
      'components/agents/**',
      'components/auth/select-company-form.tsx',
      'components/daily-log/daily-log-form.tsx',
      'components/daily-log/time-input.tsx',
      'components/departments/**',
      'components/layout/**',
      'components/tables/data-table.tsx',
      'components/tour/tour-provider.tsx',
      'features/**',
      'lib/**',
      'scripts/**',
    ],
  },
]

export default config
