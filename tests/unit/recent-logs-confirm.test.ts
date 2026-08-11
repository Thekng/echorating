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

  // Verify that window.confirm is not used in the file
  assert.equal(tableContent.includes('window.confirm'), false)

  // Verify that ConfirmDialog is imported and used
  assert.equal(tableContent.includes('ConfirmDialog'), true)
  assert.equal(tableContent.includes('deleteDailyLogAction'), true)
})

test('ConfirmDialog implements accessibility and transition attributes', () => {
  const dialogContent = read('components/shared/confirm-dialog.tsx')

  // Verify accessible role and attributes
  assert.equal(dialogContent.includes('role="alertdialog"'), true)
  assert.equal(dialogContent.includes('aria-modal="true"'), true)
  assert.equal(dialogContent.includes('aria-labelledby="confirm-dialog-title"'), true)
  assert.equal(dialogContent.includes('aria-describedby='), true)

  // Verify polished CSS classes (animations/transitions)
  assert.equal(dialogContent.includes('animate-in'), true)
  assert.equal(dialogContent.includes('fade-in'), true)
  assert.equal(dialogContent.includes('zoom-in-95'), true)

  // Verify that RefreshCw is imported for loading spinner
  assert.equal(dialogContent.includes('RefreshCw'), true)
})
