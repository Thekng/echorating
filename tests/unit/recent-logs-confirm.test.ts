import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('RecentLogsTable uses custom ConfirmDialog and does not use window.confirm', () => {
  const recentLogsTable = read('components/daily-log/recent-logs-table.tsx')

  assert.equal(recentLogsTable.includes('ConfirmDialog'), true)
  assert.equal(recentLogsTable.includes('window.confirm'), false)
})

test('ConfirmDialog correctly implements Radix UI Dialog', () => {
  const confirmDialog = read('components/shared/confirm-dialog.tsx')

  assert.equal(confirmDialog.includes("import { Dialog } from 'radix-ui'"), true)
  assert.equal(confirmDialog.includes('<Dialog.Root'), true)
  assert.equal(confirmDialog.includes('role="alertdialog"'), true)
})
