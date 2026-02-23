# Time Tracking Implementation Guide

## Overview

This guide explains how to implement HH:MM:SS time tracking in the daily log without creating conflicts between agents or with calculated metrics.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT INTERFACE                      │
│  Time Input (HH:MM:SS) → TimeInput Component           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              VALIDATION & PARSING LAYER                 │
│  parseDurationToSeconds() → Validate & Convert          │
│  formatSecondsToDuration() → Display Formatting         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              CONFLICT PREVENTION LAYER                  │
│  • Optimistic Locking (version check)                   │
│  • Unique Constraint (no duplicate entries)             │
│  • RLS Policies (company/dept isolation)                │
│  • Dependency Validation (no circular formulas)         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  DATABASE LAYER                         │
│  entry_values (value_numeric = seconds)                 │
│  daily_entries (version for concurrency)                │
│  metrics (data_type = 'duration')                       │
│  recalc_queue (async formula recalculation)             │
└─────────────────────────────────────────────────────────┘
```

## Step-by-Step Implementation

### Step 1: Create Time Metrics (SQL)

Execute the migration file:
```bash
psql -h your-host -U your-user -d your-database -f \
  lib/db/migrations/2026-02-16_add_time_tracking_metrics.sql
```

This creates:
- `talk_time` - Manual metric for tracking call duration
- `break_time` - Manual metric for tracking breaks
- `after_call_work` - Manual metric for follow-up work time
- `available_time` - **Calculated** metric (example of computed value)

**Key Property:** All time values are stored as **seconds** in the database but input/displayed as **HH:MM:SS**.

### Step 2: Add TimeInput Component to Form

```typescript
// In daily-log form component
import { TimeInput } from '@/components/daily-log/time-input'

export function DailyLogForm({ entryId, departmentId }) {
  const [formData, setFormData] = useState({
    talkTime: null,
    breakTime: null,
    afterCallWork: null,
  })
  const [errors, setErrors] = useState({})

  const handleTimeChange = (field: string, value: string | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error for this field
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Other form fields... */}
      
      <TimeInput
        label="Talk Time"
        value={formData.talkTime}
        onChange={(val) => handleTimeChange('talkTime', val)}
        error={errors.talkTime}
        required
      />

      <TimeInput
        label="Break Time"
        value={formData.breakTime}
        onChange={(val) => handleTimeChange('breakTime', val)}
        error={errors.breakTime}
      />

      <TimeInput
        label="After-Call Work"
        value={formData.afterCallWork}
        onChange={(val) => handleTimeChange('afterCallWork', val)}
        error={errors.afterCallWork}
      />

      <button type="submit">Save Entry</button>
    </form>
  )
}
```

### Step 3: Handle Form Submission with Conflict Prevention

```typescript
// In actions.ts - Enhanced with time tracking support
'use server'

import { TimeEntryVersionControl, ConflictError } from '@/lib/daily-log/time-tracking-v2'
import { parseDurationToSeconds } from '@/lib/daily-log/value-parser'

export async function saveDailyLogWithTime(
  entryId: string,
  departmentId: string,
  talkTime: string | null,
  breakTime: string | null,
  afterCallWork: string | null,
) {
  const supabase = await createClient()

  try {
    // Parse and validate all time inputs
    const times = {
      talk_time: talkTime ? parseDurationToSeconds(talkTime) : { ok: true, value: null },
      break_time: breakTime ? parseDurationToSeconds(breakTime) : { ok: true, value: null },
      after_call_work: afterCallWork ? parseDurationToSeconds(afterCallWork) : { ok: true, value: null },
    }

    // Check for parsing errors
    for (const [key, result] of Object.entries(times)) {
      if (!result.ok) {
        return {
          status: 'error',
          message: `Invalid ${key.replace(/_/g, ' ')}: ${result.message}`,
        }
      }
    }

    // Get the metrics IDs (should be created by migration)
    const { data: metrics, error: metricsError } = await supabase
      .from('metrics')
      .select('metric_id, code')
      .eq('department_id', departmentId)
      .in('code', ['talk_time', 'break_time', 'after_call_work'])

    if (metricsError) throw new Error('Failed to load metrics: ' + metricsError.message)

    // Build metric ID lookup
    const metricMap: Record<string, string> = {}
    for (const m of metrics || []) {
      metricMap[m.code] = m.metric_id
    }

    // CRITICAL: Use version-safe update to prevent conflicts
    const updates = [
      { metricId: metricMap.talk_time, timeValue: times.talk_time.value },
      { metricId: metricMap.break_time, timeValue: times.break_time.value },
      { metricId: metricMap.after_call_work, timeValue: times.after_call_work.value },
    ].filter(u => u.metricId) // Only include metrics that exist

    await TimeEntryVersionControl.updateMultipleTimeValues(
      supabase,
      entryId,
      updates as any
    )

    return {
      status: 'success',
      message: 'Time entry saved successfully',
    }

  } catch (error) {
    if (error instanceof ConflictError) {
      return {
        status: 'conflict',
        message: error.message,
        // Client should fetch latest and show merge dialog
      }
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to save entry',
    }
  }
}
```

### Step 4: Handle Conflicts in UI

```typescript
// In client component
'use client'

import { useState } from 'react'
import { saveDailyLogWithTime } from '@/features/daily-log/actions'
import { ConflictDialog } from '@/components/daily-log/conflict-dialog'

export function DailyLogForm() {
  const [error, setError] = useState<string | null>(null)
  const [showConflict, setShowConflict] = useState(false)
  const [conflictData, setConflictData] = useState(null)

  const handleSubmit = async (formData: FormData) => {
    const result = await saveDailyLogWithTime(
      formData.get('entryId') as string,
      formData.get('departmentId') as string,
      formData.get('talkTime') as string | null,
      formData.get('breakTime') as string | null,
      formData.get('afterCallWork') as string | null,
    )

    if (result.status === 'conflict') {
      // Show conflict resolution dialog
      setConflictData(result)
      setShowConflict(true)
    } else if (result.status === 'error') {
      setError(result.message)
    } else {
      setError(null)
      // Show success and redirect
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
      </form>

      {showConflict && (
        <ConflictDialog
          message={conflictData?.message}
          onRefresh={() => {
            // Fetch latest data
            window.location.reload()
          }}
          onMerge={() => {
            // Show merge UI
          }}
        />
      )}

      {error && (
        <div className="text-red-500">{error}</div>
      )}
    </>
  )
}
```

### Step 5: Display Calculated Time Values

```typescript
// Show calculated availability time (read-only)
import { TimeDisplay } from '@/components/daily-log/time-input'

export function EntryDisplayView({ entry }) {
  return (
    <div>
      <TimeDisplay 
        label="Talk Time"
        value={entry.metrics.talk_time?.value_numeric}
      />
      
      <TimeDisplay 
        label="Break Time"
        value={entry.metrics.break_time?.value_numeric}
      />
      
      {/* This is calculated by the system */}
      <TimeDisplay 
        label="Available Time (calculated)"
        value={entry.metrics.available_time?.value_numeric}
      />
    </div>
  )
}
```

## Conflict Scenarios & Prevention

### Scenario 1: Two Agents Editing Same Entry (Impossible)
- **Prevention:** Unique constraint on (entry_id, metric_id) + RLS policies
- **Result:** Each agent has their own entry per day

### Scenario 2: Manager & Agent Both Editing
- **Prevention:** Optimistic locking via version field
- **Result:** Whoever saves first wins; other gets conflict error
- **Recovery:** UI shows "Entry was modified, refresh to see latest"

### Scenario 3: Manual Time Changes Break Calculated Metric
- **Prevention:** Dependency validation + async recalc queue
- **Result:** System auto-recalculates dependent metrics asynchronously
- **Safety:** No blocking, failures logged for retry

### Scenario 4: Circular Formula Dependencies
- **Prevention:** `check_circular_dependency()` trigger
- **Result:** Database rejects circular formulas at creation time

## Testing the Implementation

### Test 1: Basic Time Entry
```bash
# Input: 02:30:45
# Expected storage: 9045 seconds
# Expected display: 02:30:45
```

### Test 2: Version Conflict
```typescript
// Open same entry in 2 browser tabs
// Tab 1: Change talk_time, click save → Success
// Tab 2: Change break_time, click save → Shows conflict error
// Expected: Tab 2 user must refresh before trying again
```

### Test 3: Calculated Metric
```typescript
// If you set up "available_time" formula:
// 1. Manual: talk_time = 02:00:00
// 2. Manual: break_time = 00:30:00
// 3. Auto-calculated: available_time should update in background
// 4. Check recalc_queue table for processing status
```

### Test 4: Validation
```typescript
// Invalid inputs that should be rejected:
- "25:00:00"    // hours > 24
- "12:75:00"    // minutes > 59
- "12:30:75"    // seconds > 59
- "abc"         // non-numeric
- "2:30:45"     // not zero-padded (should auto-pad)
```

## Monitoring & Debugging

### Check Time Metrics
```sql
SELECT 
  d.name,
  m.code,
  m.name,
  m.data_type,
  COUNT(ev.entry_value_id) as entries_with_values
FROM public.metrics m
JOIN public.departments d ON m.department_id = d.department_id
LEFT JOIN public.entry_values ev ON m.metric_id = ev.metric_id
WHERE m.data_type = 'duration'
GROUP BY m.metric_id, d.department_id, d.name, m.code, m.name, m.data_type
ORDER BY d.name, m.code;
```

### Check Recalculation Queue
```sql
SELECT 
  entry_id,
  status,
  priority,
  retry_count,
  error_message,
  requested_at
FROM public.recalc_queue
WHERE status != 'completed'
ORDER BY priority DESC, requested_at;
```

### Verify Version Locking Works
```sql
SELECT 
  entry_id,
  version,
  updated_at,
  status
FROM public.daily_entries
WHERE updated_at > now() - interval '1 hour'
ORDER BY updated_at DESC;
```

## Performance Considerations

1. **Index Optimization:** Composite index on `(company_id, department_id, data_type)`
2. **Recalc Queue:** Async processing prevents UI blocking
3. **Version Cleanup:** Versioning doesn't grow unbounded (old entries can be archived)
4. **Precision:** Duration stored as integer seconds (no floating point issues)

## Summary

✅ **Time Tracking is Ready To Deploy**

The system safely handles:
- Concurrent edits via optimistic locking
- Calculated metrics via async queue
- Data isolation via RLS policies
- Circular dependency prevention
- Precise HH:MM:SS input/output formatting

No additional database schema changes needed - just add the UI components and use the provided helper functions.
