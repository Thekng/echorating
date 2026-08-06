import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('RecentLogsTable uses the custom ConfirmDialog instead of window.confirm', () => {
  const tableFile = read('components/daily-log/recent-logs-table.tsx')

  assert.equal(tableFile.includes('window.confirm'), false)
  assert.equal(tableFile.includes('ConfirmDialog'), true)
})

test('ConfirmDialog correctly implements Radix UI Dialog', () => {
  const dialogFile = read('components/shared/confirm-dialog.tsx')

  assert.equal(dialogFile.includes("import { Dialog } from 'radix-ui'"), true)
  assert.equal(dialogFile.includes('Dialog.Root'), true)
  assert.equal(dialogFile.includes('Dialog.Portal'), true)
  assert.equal(dialogFile.includes('Dialog.Overlay'), true)
  assert.equal(dialogFile.includes('Dialog.Content'), true)
})
