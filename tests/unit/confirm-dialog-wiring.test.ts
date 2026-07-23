import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('ConfirmDialog component is highly accessible and uses Radix UI Dialog primitives', () => {
  const fileContent = read('components/shared/confirm-dialog.tsx')
  assert.equal(fileContent.includes("import { Dialog } from 'radix-ui'"), true)
  assert.equal(fileContent.includes('role="alertdialog"'), true)
  assert.equal(fileContent.includes('animate-in'), true)
  assert.equal(fileContent.includes('fade-in-0'), true)
  assert.equal(fileContent.includes('zoom-in-95'), true)
})

test('RecentLogsTable correctly uses custom ConfirmDialog for deletions instead of window.confirm', () => {
  const fileContent = read('components/daily-log/recent-logs-table.tsx')
  assert.equal(fileContent.includes('window.confirm'), false)
  assert.equal(fileContent.includes('<ConfirmDialog'), true)
  assert.equal(fileContent.includes('logToDelete'), true)
  assert.equal(fileContent.includes('isPending'), true)
  assert.equal(fileContent.includes('deleteDailyLogAction'), true)
})
