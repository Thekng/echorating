import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('DepartmentPicker includes combobox, listbox, option ARIA roles and Escape key handler', () => {
  const departmentPicker = read('components/filters/department-picker.tsx')

  assert.equal(departmentPicker.includes('role="combobox"'), true)
  assert.equal(departmentPicker.includes('role="listbox"'), true)
  assert.equal(departmentPicker.includes('role="option"'), true)
  assert.equal(departmentPicker.includes('aria-expanded'), true)
  assert.equal(departmentPicker.includes('aria-controls="department-picker-list"'), true)
  assert.equal(departmentPicker.includes('aria-selected'), true)
  assert.equal(departmentPicker.includes("e.key === 'Escape'"), true)
})
