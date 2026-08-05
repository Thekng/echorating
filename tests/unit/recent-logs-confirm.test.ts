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

  // Confirm dialog is imported and used
  assert.equal(tableFile.includes("ConfirmDialog"), true)
  assert.equal(tableFile.includes("@/components/shared/confirm-dialog"), true)

  // window.confirm is not used in recent-logs-table
  assert.equal(tableFile.includes("window.confirm"), false)
})

test('ConfirmDialog implements Radix UI Dialog', () => {
  const dialogFile = read('components/shared/confirm-dialog.tsx')

  // Radix UI Dialog is used
  assert.equal(dialogFile.includes("import { Dialog } from 'radix-ui'"), true)
  assert.equal(dialogFile.includes("<Dialog.Root"), true)
  assert.equal(dialogFile.includes("<Dialog.Content"), true)
  assert.equal(dialogFile.includes("<Dialog.Title"), true)
  assert.equal(dialogFile.includes("<Dialog.Description"), true)
  assert.equal(dialogFile.includes("<Dialog.Close"), true)
})
