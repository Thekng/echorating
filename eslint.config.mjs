import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      'app/**',
      'components/agents/**',
      'components/auth/select-company-form.tsx',
      'components/daily-log/**',
      'components/departments/**',
      'components/layout/**',
      'components/tables/**',
      'components/tour/**',
      'features/**',
      'lib/**',
      'scripts/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default config
