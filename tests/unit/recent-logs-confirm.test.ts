import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('ConfirmDialog uses Radix UI primitives and alertdialog role', () => {
  const confirmDialog = read('components/shared/confirm-dialog.tsx')

  assert.equal(confirmDialog.includes("import { Dialog } from 'radix-ui'"), true)
  assert.equal(confirmDialog.includes('role="alertdialog"'), true)
  assert.equal(confirmDialog.includes('Dialog.Root'), true)
  assert.equal(confirmDialog.includes('Dialog.Content'), true)
})

test('RecentLogsTable uses ConfirmDialog instead of window.confirm', () => {
  const recentLogsTable = read('components/daily-log/recent-logs-table.tsx')

  assert.equal(recentLogsTable.includes('ConfirmDialog'), true)
  assert.equal(recentLogsTable.includes('window.confirm'), false)
  assert.equal(recentLogsTable.includes('aria-label="Delete log entry"'), true)
})
