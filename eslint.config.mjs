import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/no-anonymous-default-export': 'off'
    }
  }
]
