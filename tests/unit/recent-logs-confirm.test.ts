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
  const recentLogsTable = read('components/daily-log/recent-logs-table.tsx')

  // Verify that recent-logs-table imports and renders ConfirmDialog
  assert.ok(recentLogsTable.includes('ConfirmDialog'), 'RecentLogsTable should use ConfirmDialog')

  // Verify that it no longer contains window.confirm for deletions
  assert.equal(recentLogsTable.includes('window.confirm'), false, 'RecentLogsTable should not use window.confirm')
})

test('ConfirmDialog correctly implements Radix UI Dialog primitives', () => {
  const confirmDialog = read('components/shared/confirm-dialog.tsx')

  // Verify that it imports from radix-ui
  assert.ok(confirmDialog.includes('radix-ui'), 'ConfirmDialog should import from radix-ui')

  // Verify that DialogPrimitive.Root is used
  assert.ok(confirmDialog.includes('DialogPrimitive.Root'), 'ConfirmDialog should implement DialogPrimitive.Root')

  // Verify alertdialog role is implemented for accessibility
  assert.ok(confirmDialog.includes('role="alertdialog"'), 'ConfirmDialog should use ARIA role alertdialog')
})
