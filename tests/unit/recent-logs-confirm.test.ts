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
  const tableFile = read('components/daily-log/recent-logs-table.tsx')

  assert.equal(tableFile.includes('ConfirmDialog'), true)
  assert.equal(tableFile.includes('window.confirm'), false)
})

test('ConfirmDialog implements Radix UI Dialog primitives and is accessible', () => {
  const dialogFile = read('components/shared/confirm-dialog.tsx')

  assert.equal(dialogFile.includes("Dialog as D } from 'radix-ui'"), true)
  assert.equal(dialogFile.includes('role="alertdialog"'), true)
  assert.equal(dialogFile.includes('D.Root'), true)
  assert.equal(dialogFile.includes('D.Portal'), true)
  assert.equal(dialogFile.includes('D.Overlay'), true)
  assert.equal(dialogFile.includes('D.Content'), true)
})
