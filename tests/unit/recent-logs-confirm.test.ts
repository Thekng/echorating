import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('RecentLogsTable uses ConfirmDialog instead of window.confirm', () => {
  const tablePath = path.resolve(process.cwd(), 'components/daily-log/recent-logs-table.tsx')
  const content = fs.readFileSync(tablePath, 'utf8')

  assert.ok(content.includes('ConfirmDialog'), 'RecentLogsTable should import/use ConfirmDialog')
  assert.ok(!content.includes('window.confirm'), 'RecentLogsTable should not use window.confirm')
})

test('ConfirmDialog correctly implements Radix UI Dialog primitives', () => {
  const dialogPath = path.resolve(process.cwd(), 'components/shared/confirm-dialog.tsx')
  const content = fs.readFileSync(dialogPath, 'utf8')

  assert.ok(content.includes('Dialog.Root'), 'ConfirmDialog should use Dialog.Root')
  assert.ok(content.includes('Dialog.Portal'), 'ConfirmDialog should use Dialog.Portal')
  assert.ok(content.includes('Dialog.Overlay'), 'ConfirmDialog should use Dialog.Overlay')
  assert.ok(content.includes('Dialog.Content'), 'ConfirmDialog should use Dialog.Content')
  assert.ok(content.includes('role="alertdialog"'), 'ConfirmDialog should have alertdialog role')
})
