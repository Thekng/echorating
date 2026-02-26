import test from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.E2E_BASE_URL
const SETTINGS_ROUTES = [
  '/settings',
  '/settings/company',
  '/settings/departments',
  '/settings/members',
  '/settings/metrics',
]

if (!BASE_URL) {
  test('settings auth redirect e2e requires E2E_BASE_URL', { skip: true }, () => {})
} else {
  for (const route of SETTINGS_ROUTES) {
    test(`unauthenticated request to ${route} redirects to login`, async () => {
      const response = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' })
      const location = response.headers.get('location') ?? ''

      assert.ok([301, 302, 303, 307, 308].includes(response.status), `expected redirect status, got ${response.status}`)
      assert.match(location, /\/login\?/)
      assert.ok(
        location.includes(`next=${encodeURIComponent(route)}`),
        `expected next param for route "${route}", got "${location}"`,
      )
    })
  }
}
