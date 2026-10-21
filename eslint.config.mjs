import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'dist/**',
      'node_modules/**',
      'app/**',
      'components/agents/**',
      'components/daily-log/**',
      'components/departments/**',
      'components/layout/**',
      'components/tables/**',
      'components/tour/**',
      'components/auth/select-company-form.tsx',
      'features/**',
      'lib/**',
      'scripts/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default config
