# Time Tracking - Visual Architecture & Reference

## System Overview

```
╔════════════════════════════════════════════════════════════════════╗
║                    DAILY LOG TIME TRACKING SYSTEM                 ║
╚════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────┐
│  AGENT INTERFACE (Client)                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  TimeInput Component                                    │   │
│  │  ┌──────────────┐  User types: "2:30:45"               │   │
│  │  │  [02:30:45] │ ─────────────────────────────────┐    │   │
│  │  │  +1m  -1m X │                                 │    │   │
│  │  └──────────────┘                                 │    │   │
│  │  Format: HH:MM:SS • Use ↑/↓ to adjust             │    │   │
│  └──────────────────────────────────────────────────┼────┘   │
│                                                      │         │
│  ┌──────────────────────────────────────────────────┴────┐    │
│  │ TimeRangeInput (optional)                             │    │
│  │ Start: [09:00:00] ─────→ End: [17:00:00]             │    │
│  │ Duration: 08:00:00 (calculated)                      │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  VALIDATION & PARSING LAYER                                     │
│                                                                  │
│  parseDurationToSeconds("02:30:45")                             │
│  ├─ Regex: /^(\d{1,2}):(\d{2}):(\d{2})$/                       │
│  ├─ Validate: mm ≤ 59, ss ≤ 59                                 │
│  └─ Return: { ok: true, value: 9045 } ← seconds                │
│                                                                  │
│  formatSecondsToDuration(9045)                                  │
│  └─ Return: "02:30:45" ← for display                           │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CONFLICT PREVENTION LAYER                                      │
│                                                                  │
│  TimeEntryVersionControl.updateMultipleTimeValues(...)          │
│  ├─ Step 1: Fetch current version                              │
│  │   SELECT version FROM daily_entries WHERE entry_id = X     │
│  │                                                              │
│  ├─ Step 2: Upsert time values                                 │
│  │   INSERT INTO entry_values (entry_id, metric_id, value_...) │
│  │   ON CONFLICT (entry_id, metric_id)                         │
│  │   DO UPDATE SET value_numeric = ...                          │
│  │                                                              │
│  ├─ Step 3: Version-safe update                                │
│  │   UPDATE daily_entries                                       │
│  │   WHERE entry_id = X                                        │
│  │   AND version = <old_version>  ◄── OPTIMISTIC LOCKING       │
│  │                                                              │
│  └─ If version mismatch: ConflictError("Entry was modified")   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE LAYER (Supabase PostgreSQL)                           │
│                                                                  │
│  Table: daily_entries                                           │
│  ├─ entry_id (UUID)                                            │
│  ├─ version (INT) ◄── Incremented on each update              │
│  ├─ status ('draft' | 'submitted')                            │
│  ├─ updated_at (TIMESTAMP)                                    │
│  └─ ... other fields                                           │
│                                                                  │
│  Table: entry_values                                            │
│  ├─ entry_id (UUID) ──┐                                        │
│  ├─ metric_id (UUID)  ├─ UNIQUE CONSTRAINT                     │
│  │                   (no duplicate values per metric)           │
│  ├─ value_numeric (NUMERIC) ◄── Time stored as seconds         │
│  ├─ value_source ('manual' | 'calculated')                    │
│  └─ updated_at (TIMESTAMP)                                    │
│                                                                  │
│  Table: metrics                                                 │
│  ├─ metric_id (UUID)                                           │
│  ├─ code ('talk_time', 'break_time', etc.)                    │
│  ├─ data_type ('duration') ◄── Time metrics only              │
│  ├─ input_mode ('manual' | 'calculated')                      │
│  └─ ... other fields                                           │
│                                                                  │
│  Table: recalc_queue (For calculated metrics)                   │
│  ├─ entry_id (UUID)                                            │
│  ├─ status ('pending' | 'processing' | 'completed' | 'failed') │
│  ├─ priority (INT)                                             │
│  └─ ... retry logic                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Transformation Examples

### Example 1: Talk Time Entry
```
Input:      "02:30:45" (2 hours, 30 minutes, 45 seconds)
           ↓ parseDurationToSeconds()
Stored:     9045 (seconds in database)
           ↓ formatSecondsToDuration()
Display:    "02:30:45"
```

### Example 2: Break Time Entry
```
Input:      "00:15:00" (15 minutes)
           ↓ parseDurationToSeconds()
Stored:     900 (seconds)
           ↓ formatSecondsToDuration()
Display:    "00:15:00"
```

### Example 3: Calculated Availability
```
Manual Entry 1: talk_time = "02:30:00" (9000 seconds)
Manual Entry 2: break_time = "00:30:00" (1800 seconds)

Formula: available_time = (28800 - talk_time - break_time)
        = 28800 - 9000 - 1800
        = 18000 seconds
        ↓ formatSecondsToDuration()
Display: "05:00:00"
```

## Conflict Scenarios & Prevention

### Scenario 1: Concurrent Edits (Prevented ✅)

```
Timeline:

Agent A (Tab 1)                          Agent B (Tab 2)
──────────────                          ──────────────
Load entry (version=5)
                                         Load entry (version=5)
Edit talk_time = "02:00:00"
                                         Edit break_time = "00:30:00"
Click Save
  ├─ Fetch version → 5 ✓
  ├─ Upsert talk_time
  ├─ UPDATE version WHERE version=5
  │   → version becomes 6 ✓
  └─ Success
                                         Click Save
                                         ├─ Fetch version → 6
                                         ├─ Upsert break_time
                                         ├─ UPDATE version WHERE version=5
                                         │   → WHERE clause fails ✗
                                         └─ ConflictError!
                                            "Entry was modified"

Result: Agent B sees error, must refresh
```

### Scenario 2: Calculated Metric Update (Async Safe ✅)

```
Manual entry changes:
  talk_time = "02:00:00"
           ↓ Trigger: enqueue_recalc_on_manual_change()
Recalc Queue:
  entry_id = xyz
  status = 'pending'
  priority = 5
           ↓ Background worker (asynchronously)
Calculate available_time:
  = working_hours - talk_time - break_time
  = result stored in calculated_values
           ↓ Trigger: mirror_calculated_to_entry_values()
Update entry_values with calculated result
           ↓ Dashboard query shows updated value
```

### Scenario 3: Circular Dependency (Prevented ✅)

```
Attempted formula:
  talk_time = (available_time - break_time)

Database validation:
  check_circular_dependency() trigger fires
           ↓
  Detect path: available_time → break_time → talk_time → available_time
           ↓
  Raise exception: "Circular dependency detected"
           ↓
  Insert rejected ✗
```

## Version Locking Mechanism

```
Optimistic Locking Pattern:

1️⃣  CLIENT: Read current version
    SELECT version FROM daily_entries WHERE entry_id = X
    → version = 5

2️⃣  CLIENT: Make changes locally (in browser)
    form.talkTime = "02:30:45"
    form.breakTime = "00:15:00"

3️⃣  CLIENT: Send update with old version
    UPDATE daily_entries
    SET updated_at = NOW()
    WHERE entry_id = X
    AND version = 5  ◄── KEY: Check version matches

4️⃣  DATABASE: Version matches, proceed
    → UPDATE succeeds
    → version auto-increments to 6 (trigger)
    ✓ Success

    OR

4️⃣  DATABASE: Version doesn't match (someone else edited)
    → WHERE clause finds 0 rows
    → UPDATE returns affected_rows = 0
    ✗ Conflict detected

5️⃣  CLIENT: Check result
    if (affectedRows === 0) {
      throw new ConflictError("Entry was modified")
    }
```

## RLS (Row Level Security) Policy

```
Users can only edit their own daily entries:

RLS Policy on daily_entries:
├─ MANAGERS:
│  └─ Can edit any entry in their departments
├─ MEMBERS:
│  └─ Can only edit their own entries
└─ OWNERS:
   └─ Can edit any entry in their company

Entry isolation:
  user_id = current_user_id OR
  user_department IN (user_departments) AND is_manager
```

## Monitoring & Debugging

### Check Entry Version History
```sql
SELECT 
  entry_id,
  version,
  status,
  updated_at,
  COUNT(*) OVER (PARTITION BY entry_id) as update_count
FROM daily_entries
WHERE updated_at > now() - interval '24 hours'
ORDER BY updated_at DESC;
```

### Monitor Recalculation Queue
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(EPOCH FROM (processed_at - requested_at)))) as avg_processing_time_sec
FROM recalc_queue
WHERE requested_at > now() - interval '24 hours'
GROUP BY status;
```

### Time Values Distribution
```sql
SELECT 
  m.code,
  m.name,
  COUNT(*) as entries,
  AVG(ev.value_numeric) as avg_seconds,
  MAX(ev.value_numeric) as max_seconds,
  MIN(ev.value_numeric) as min_seconds
FROM entry_values ev
JOIN metrics m ON ev.metric_id = m.metric_id
WHERE m.data_type = 'duration'
GROUP BY m.metric_id, m.code, m.name;
```

## Integration Checklist

- [ ] Run migration: `2026-02-16_add_time_tracking_metrics.sql`
- [ ] Verify metrics created: `talk_time`, `break_time`, `after_call_work`
- [ ] Add `TimeInput` component to daily log form
- [ ] Use `TimeEntryVersionControl` for submission
- [ ] Add error handling for `ConflictError`
- [ ] Test concurrent edits (2 browser tabs)
- [ ] Monitor `recalc_queue` table for calculated metrics
- [ ] Add time value display to entry history
- [ ] Set up alerts for `recalc_queue` failures
- [ ] Document time entry procedures for agents

## Performance Notes

- **Query:** Fetching entries with time values is O(1) with proper indexing
- **Storage:** 4 bytes per time value (integer seconds)
- **Recalc:** Async, doesn't block UI
- **Precision:** Integer seconds (sufficient for most scenarios)
- **Scaling:** Ready for millions of entries via partitioning

## Security Notes

- **Encryption:** Values encrypted at transit (HTTPS/TLS)
- **Isolation:** RLS prevents cross-company/cross-department access
- **Audit:** `created_by`, `updated_by` tracked automatically
- **Version:** Optimistic locking prevents stale data updates
