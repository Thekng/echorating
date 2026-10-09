import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('RecentLogsTable uses custom accessible ConfirmDialog instead of window.confirm', () => {
  const filePath = path.join(process.cwd(), 'components/daily-log/recent-logs-table.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.equal(content.includes('window.confirm'), false, 'RecentLogsTable should not contain window.confirm')
  assert.equal(content.includes('ConfirmDialog'), true, 'RecentLogsTable should import and use ConfirmDialog')
})

test('ConfirmDialog implements Radix UI Dialog primitives and alertdialog role', () => {
  const filePath = path.join(process.cwd(), 'components/shared/confirm-dialog.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.equal(content.includes("role=\"alertdialog\""), true, 'ConfirmDialog must specify role="alertdialog"')
  assert.equal(content.includes("import { Dialog } from 'radix-ui'"), true, 'ConfirmDialog must use radix-ui Dialog primitives')
})
