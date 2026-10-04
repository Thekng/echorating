import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const eslintConfig = [
  {
    ignores: [
      'app/(app)/**',
      'app/error.tsx',
      'app/global-error.tsx',
      'components/agents/**',
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
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default eslintConfig
