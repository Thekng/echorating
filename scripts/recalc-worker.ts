import { createAdminClient } from '../lib/supabase/admin'
import { parseFormulaExpression } from '../lib/metrics/formula'

const admin = createAdminClient()

function evaluateTokens(tokens: Array<{ type: string; value: string }>, values: Record<string, number>): number {
  // Convert tokens to Reverse Polish Notation (shunting-yard)
  const output: Array<{ type: string; value: string }> = []
  const ops: string[] = []

  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

  for (const t of tokens) {
    if (t.type === 'number' || t.type === 'metric') {
      output.push(t)
      continue
    }

    if (t.type === 'operator') {
      while (ops.length > 0) {
        const top = ops[ops.length - 1]
        if (top === '(') break
        if (precedence[top] >= precedence[t.value]) {
          output.push({ type: 'operator', value: ops.pop() as string })
          continue
        }
        break
      }
      ops.push(t.value)
      continue
    }

    if (t.type === 'paren') {
      if (t.value === '(') {
        ops.push('(')
      } else {
        while (ops.length > 0 && ops[ops.length - 1] !== '(') {
          output.push({ type: 'operator', value: ops.pop() as string })
        }
        ops.pop()
      }
    }
  }

  while (ops.length > 0) {
    output.push({ type: 'operator', value: ops.pop() as string })
  }

  // Evaluate RPN
  const stack: number[] = []
  for (const token of output) {
    if (token.type === 'number') {
      stack.push(Number(token.value))
      continue
    }

    if (token.type === 'metric') {
      const code = token.value.toLowerCase()
      const val = values[code]
      stack.push(typeof val === 'number' && !Number.isNaN(val) ? val : 0)
      continue
    }

    // operator
    const b = stack.pop() ?? 0
    const a = stack.pop() ?? 0
    switch (token.value) {
      case '+':
        stack.push(a + b)
        break
      case '-':
        stack.push(a - b)
        break
      case '*':
        stack.push(a * b)
        break
      case '/':
        stack.push(b === 0 ? 0 : a / b)
        break
      default:
        stack.push(0)
    }
  }

  return stack.pop() ?? 0
}

async function processNextJob(workerId = 'recalc-worker-local') {
  // Dequeue next job
  const { data: jobData, error: jobError } = await admin.rpc('dequeue_recalc_job', {
    worker_id: workerId,
    lock_duration_seconds: 300,
  }) as any

  if (jobError) {
    console.error('dequeue error', jobError)
    return false
  }

  const job = Array.isArray(jobData) ? jobData[0] : jobData
  if (!job || !job.entry_id) {
    return false
  }

  const entryId = job.entry_id

  try {
    // Fetch entry values
    const { data: ev, error: evError } = await admin
      .from('entry_values')
      .select('metric_id, value_numeric')
      .eq('entry_id', entryId)

    if (evError) throw evError

    const metricIds = Array.from(new Set((ev ?? []).map((r: any) => r.metric_id)))

    const { data: metrics, error: metricsError } = await admin
      .from('metrics')
      .select('metric_id, code')
      .in('metric_id', metricIds)

    if (metricsError) throw metricsError

    const codeById: Record<string, string> = {}
    for (const m of metrics ?? []) codeById[m.metric_id] = String(m.code).toLowerCase()

    const valuesByCode: Record<string, number> = {}
    for (const r of ev ?? []) {
      const code = codeById[r.metric_id]
      if (code) valuesByCode[code] = Number(r.value_numeric) || 0
    }

    // Fetch all current formulas
    const { data: formulas, error: formulasError } = await admin
      .from('metric_formulas')
      .select('formula_id, metric_id, expression, version')
      .eq('is_current', true)

    if (formulasError) throw formulasError

    for (const f of formulas ?? []) {
      const parsed = parseFormulaExpression(String(f.expression || ''))
      if (!parsed.success) continue

      // Evaluate only if the formula references metrics (otherwise will be numbers)
      const result = evaluateTokens(parsed.tokens as any, valuesByCode)

      // Upsert calculated_values for this entry & metric
      const now = new Date().toISOString()
      const { error: upsertError } = await admin
        .from('calculated_values')
        .upsert({
          entry_id: entryId,
          metric_id: f.metric_id,
          value_numeric: result,
          computed_at: now,
          formula_id: f.formula_id,
          calc_trace: { evaluated_at: now },
        }, { onConflict: 'entry_id,metric_id' })

      if (upsertError) {
        throw upsertError
      }
    }

    // Mark job complete
    await admin.rpc('complete_recalc_job', { job_entry_id: entryId, success: true, error_msg: null })
    return true
  } catch (err: any) {
    console.error('processing error', err?.message ?? err)
    await admin.rpc('complete_recalc_job', { job_entry_id: entryId, success: false, error_msg: String(err?.message ?? err) })
    return true
  }
}

async function main() {
  console.log('recalc worker starting (press Ctrl+C to stop)')
  while (true) {
    try {
      const didWork = await processNextJob()
      if (!didWork) {
        // sleep 1s
        await new Promise((r) => setTimeout(r, 1000))
      }
    } catch (e) {
      console.error('worker loop error', e)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
