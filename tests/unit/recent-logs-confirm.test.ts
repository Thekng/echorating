import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('ConfirmDialog uses Radix UI Dialog primitives and alertdialog ARIA role', () => {
  const confirmDialogContent = read('components/shared/confirm-dialog.tsx')

  assert.equal(confirmDialogContent.includes("import { Dialog } from 'radix-ui'"), true)
  assert.equal(confirmDialogContent.includes('role="alertdialog"'), true)
  assert.equal(confirmDialogContent.includes('Dialog.Portal'), true)
  assert.equal(confirmDialogContent.includes('Dialog.Overlay'), true)
  assert.equal(confirmDialogContent.includes('Dialog.Title'), true)
  assert.equal(confirmDialogContent.includes('Dialog.Description'), true)
})

test('RecentLogsTable uses ConfirmDialog instead of window.confirm', () => {
  const recentLogsTableContent = read('components/daily-log/recent-logs-table.tsx')

  assert.equal(recentLogsTableContent.includes('ConfirmDialog'), true)
  assert.equal(recentLogsTableContent.includes('window.confirm'), false)
  assert.equal(recentLogsTableContent.includes('logToDelete'), true)
  assert.equal(recentLogsTableContent.includes('isDeleting'), true)
})
