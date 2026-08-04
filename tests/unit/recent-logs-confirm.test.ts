import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('RecentLogsTable uses custom ConfirmDialog instead of window.confirm', () => {
  const tableContent = read('components/daily-log/recent-logs-table.tsx')

  // Verify that window.confirm is no longer used
  assert.equal(tableContent.includes('window.confirm'), false)
  // Verify that ConfirmDialog is imported and used
  assert.equal(tableContent.includes('ConfirmDialog'), true)
})

test('ConfirmDialog implements Radix UI Dialog primitives', () => {
  const dialogContent = read('components/shared/confirm-dialog.tsx')

  // Verify that radix-ui Dialog is imported and used
  assert.equal(dialogContent.includes("import { Dialog } from 'radix-ui'"), true)
  assert.equal(dialogContent.includes('<Dialog.Root'), true)
  assert.equal(dialogContent.includes('<Dialog.Portal'), true)
  assert.equal(dialogContent.includes('role="alertdialog"'), true)
})
