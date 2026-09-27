import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'components/agents/**',
      'components/auth/select-company-form.tsx',
      'components/daily-log/time-input.tsx',
      'components/departments/**',
      'components/layout/**',
      'components/metrics/**',
      'components/tables/**',
      'components/tour/**',
      'features/**',
      'lib/**',
      'scripts/**',
      'app/error.tsx',
      'app/global-error.tsx',
      'app/(app)/dashboard/error.tsx',
      'app/(app)/settings/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default config
