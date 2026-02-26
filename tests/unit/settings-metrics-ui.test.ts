import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('metrics create/edit UI no longer includes advanced settings section', () => {
  const createModal = read('components/metrics/create-metric-modal.tsx')
  const editModal = read('components/metrics/edit-metric-modal.tsx')

  assert.equal(createModal.includes('Advanced settings'), false)
  assert.equal(editModal.includes('Advanced settings'), false)
})

test('boolean labels are presented as Yes/No in settings metrics surfaces', () => {
  const createModal = read('components/metrics/create-metric-modal.tsx')
  const editModal = read('components/metrics/edit-metric-modal.tsx')
  const settingsMetricsPage = read('app/(app)/settings/metrics/page.tsx')

  assert.equal(createModal.includes('Yes / No'), true)
  assert.equal(editModal.includes('Yes / No'), true)
  assert.equal(settingsMetricsPage.includes("boolean: 'Yes / No'"), true)
})

test('formula builder exposes Notion-like IF/AND/OR helpers', () => {
  const formulaBuilder = read('components/metrics/formula-builder.tsx')

  assert.equal(formulaBuilder.includes('IF('), true)
  assert.equal(formulaBuilder.includes('AND('), true)
  assert.equal(formulaBuilder.includes('OR('), true)
  assert.equal(formulaBuilder.includes('Comparisons'), true)
})
