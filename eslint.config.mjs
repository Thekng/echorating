import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      'components/agents/**',
      'components/auth/select-company-form.tsx',
      'components/daily-log/daily-log-form.tsx',
      'components/departments/**',
      'components/layout/**',
      'components/metrics/**',
      'components/tables/**',
      'components/tour/**',
      'features/**',
      'lib/actions/**',
      'lib/daily-log/time-tracking-v2.ts',
      'lib/supabase/**',
      'scripts/**',
      'app/**',
    ],
  },
]

export default config
