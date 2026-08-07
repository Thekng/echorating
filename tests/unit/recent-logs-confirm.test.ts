import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('RecentLogsTable uses ConfirmDialog instead of window.confirm', () => {
  const recentLogsTable = read('components/daily-log/recent-logs-table.tsx')

  // It should import ConfirmDialog
  assert.equal(recentLogsTable.includes('ConfirmDialog'), true)

  // It should NOT contain window.confirm
  assert.equal(recentLogsTable.includes('window.confirm'), false)
})

test('ConfirmDialog implements Radix UI Dialog primitives and RefreshCw', () => {
  const confirmDialog = read('components/shared/confirm-dialog.tsx')

  // It should import Dialog from radix-ui
  assert.equal(confirmDialog.includes("import { Dialog } from 'radix-ui'"), true)

  // It should import RefreshCw
  assert.equal(confirmDialog.includes('RefreshCw'), true)

  // It should implement Dialog.Root
  assert.equal(confirmDialog.includes('<Dialog.Root'), true)
})
