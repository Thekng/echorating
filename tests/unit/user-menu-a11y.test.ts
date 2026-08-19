import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('UserMenu trigger includes accessible aria-label', () => {
  const userMenuCode = read('components/layout/user-menu.tsx')
  assert.equal(userMenuCode.includes('aria-label="User menu"'), true)
})

test('UserMenu logout button is wrapped in DropdownMenuItem asChild for proper keyboard navigation', () => {
  const userMenuCode = read('components/layout/user-menu.tsx')
  assert.equal(userMenuCode.includes('<DropdownMenuItem asChild>'), true)
  assert.equal(userMenuCode.includes('Log out'), true)
})
