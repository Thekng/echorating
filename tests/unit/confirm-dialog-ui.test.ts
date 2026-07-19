import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('ConfirmDialog utilizes Radix UI alertdialog role and supports loading states', () => {
  const confirmDialog = read('components/shared/confirm-dialog.tsx')

  assert.equal(confirmDialog.includes('role="alertdialog"'), true)
  assert.equal(confirmDialog.includes('isLoading'), true)
  assert.equal(confirmDialog.includes('Dialog.Root'), true)
  assert.equal(confirmDialog.includes('Dialog.Portal'), true)
})

test('RecentLogsTable integrates ConfirmDialog for safe, transition-managed log deletion', () => {
  const recentLogsTable = read('components/daily-log/recent-logs-table.tsx')

  assert.equal(recentLogsTable.includes('ConfirmDialog'), true)
  assert.equal(recentLogsTable.includes('logToDelete'), true)
  assert.equal(recentLogsTable.includes('startTransition'), true)
  assert.equal(recentLogsTable.includes('deleteDailyLogAction'), true)
  assert.equal(recentLogsTable.includes('window.confirm'), false)
})
