# Investigation: System Issues & Step-by-Step Fix Plan

## Issues Found

1. **Metric data types incomplete** — 4 types can't be created from settings, 3 types missing sub-option config, no unit labels in daily log inputs, settings JSON not persisted
2. **Cannot add members** — creation modal and action are stubs
3. **Cannot deactivate members** — only permanent deletion exists
4. **No metric trends** — no way to see if a metric is trending up or down for a selected date range

---

## Step-by-Step Execution Plan

### Step 1: Persist `settings` JSON in metric create/update actions

**Why first**: Nothing else works without this. Even if we add sub-option fields to the UI, the data won't save.

**Files to change:**
- `features/metrics/actions.ts` — `createMetricAction` and `updateMetricAction` must read settings fields from `formData` and write them to the `settings` JSONB column

**What to do:**
- In both actions, collect type-specific fields from `formData` (e.g., `numberKind`, `currencyCode`, `durationFormat`, etc.)
- Call `normalizeMetricSettings(dataType, collectedFields)` to validate
- Pass the resulting object to the Supabase `.insert()` / `.update()` call as the `settings` field

---

### Step 2: Expand `METRIC_DATA_TYPES` and add labels

**Why**: 4 data types (duration, datetime, selection, file) exist in the system but can't be created from the settings UI.

**Files to change:**
- `lib/metrics/data-types.ts:2-8` — Add `'duration'`, `'datetime'`, `'selection'`, `'file'` to `METRIC_DATA_TYPES`
- `components/metrics/create-metric-modal.tsx` — Expand `DATA_TYPE_LABELS`
- `components/metrics/edit-metric-modal.tsx` — Expand `DATA_TYPE_LABELS`

**New labels:**
```
duration   → "Duration"
datetime   → "Date / Time"
selection  → "Selection"
file       → "File / Link"
```

---

### Step 3: Add conditional sub-option fields in create/edit metric modals

**Why**: Each data type has settings that are silently defaulting because there's no UI to configure them.

**Files to change:**
- `components/metrics/create-metric-modal.tsx`
- `components/metrics/edit-metric-modal.tsx`

**Sub-option fields to show when each data type is selected:**

| Data Type | Field Name | Input Type | Options |
|-----------|-----------|------------|---------|
| `number` | `numberKind` | Select | Integer, Decimal |
| `currency` | `currencyCode` | Select | USD, EUR, GBP, CAD, AUD, BRL (or text input) |
| `boolean` | `booleanPreset` | Select | Yes/No, True/False, Active/Inactive, Completed/Not Completed, Qualified/Not Qualified |
| `text` | `textFormat` | Select | Short text, Long text, Email, Phone, URL |
| `duration` | `durationFormat` | Select | HH:MM:SS, Minutes, Hours, Days |
| `datetime` | `datetimeFormat` | Select | Date, Date & Time, Time |
| `selection` | `selectionMode` | Select | Single choice, Multiple choice, Radio buttons |
| `selection` | `selectionOptions` | Textarea | One option per line |
| `file` | `fileKind` | Select | File, Image |
| `percentage` | — | — | No sub-options needed |

**Behavior:**
- When user changes data type in the dropdown, show/hide the relevant sub-option fields
- Pre-populate defaults matching `normalizeMetricSettings()` logic
- On edit modal, populate from the metric's existing `settings` JSON

---

### Step 4: Add unit labels/suffixes in daily log inputs

**Why**: Currency input shows no `$`, percentage shows no `%`, duration (minutes/hours/days) shows no unit. Users don't know what they're entering.

**File to change:**
- `components/daily-log/daily-log-form.tsx`

**Changes in `renderMetricInput()`:**

| Data Type | Current | Fix |
|-----------|---------|-----|
| `currency` | Plain `<input type="number">` | Wrap in flex container, add currency symbol prefix (from `settings.currencyCode`) |
| `percentage` | Plain `<input type="number">` | Wrap in flex container, add `%` suffix |
| `duration` (non-hh_mm_ss) | Plain `<input type="number">` with format name as placeholder | Add unit suffix label: `min` / `hrs` / `days` |

**Implementation pattern:**
```tsx
<div className="flex items-center gap-1.5">
  <span className="text-sm text-muted-foreground">$</span>
  <input type="number" ... className="flex-1 ..." />
</div>
```

---

### Step 5: Member deactivation

**Why**: Firing a member currently means permanent deletion, losing the org/department association. Historical daily log data becomes orphaned.

#### 5a. Database migration

Create `supabase/migrations/YYYYMMDD_member_is_active.sql`:

```sql
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_org_members_active
  ON public.organization_members (organization_id, is_active);
```

#### 5b. Deactivation + reactivation actions

**File:** `features/members/actions.ts`

Add two new server actions:

**`deactivateMemberAction`:**
- Set `is_active = false` on `organization_members`
- Delete all `department_members` rows for this user+org (they shouldn't be in departments if inactive)
- Cannot deactivate yourself or last owner

**`reactivateMemberAction`:**
- Set `is_active = true` on `organization_members`
- Does NOT auto-assign to departments (admin should do that manually)

#### 5c. Query updates

**Files:**
- `features/members/queries.ts` — `listMembers()`: add `is_active` filter, default to `true`, accept optional `showInactive` param
- `features/daily-log/queries.ts` — `getDepartmentAgents()`: filter by active membership so deactivated members don't appear in daily log agent dropdown
- Dashboard, leaderboard, accountability queries — exclude inactive members from aggregations

#### 5d. UI updates

**Files:**
- `app/(app)/settings/members/page.tsx` — Add "Show inactive" toggle filter
- Member row component — Add "Inactive" badge, show "Deactivate"/"Reactivate" in action menu
- Confirmation dialog for deactivation: "This member will be removed from all departments and won't be able to access the workspace. Their historical data will be preserved."

---

### Step 6: Member creation/invitation

**Why**: Currently no way to add new members. The modal and action are stubs returning null/error.

#### 6a. Server action

**File:** `features/members/actions.ts` — Replace stub `createMemberAction`:

- Accept: email, role, departmentId (optional)
- Look up user by email in `auth.users` (via admin API)
- **If user exists**: insert into `organization_members`, optionally insert into `department_members`
- **If user doesn't exist**: create invitation record + send invite email via Resend. When they sign up, auto-add to org.

#### 6b. Modal UI

**File:** `components/members/create-member-modal.tsx` — Replace null stub:

- Email input
- Role selector (member, manager, admin)
- Department selector (optional)
- Submit button

#### 6c. Invitation table (if doing invite-by-email for non-existing users)

May need a new `organization_invitations` table:

```sql
CREATE TABLE public.organization_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'member',
  department_id   uuid REFERENCES public.departments(id),
  invited_by      uuid NOT NULL REFERENCES public.profiles(id),
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

Alternatively, for a simpler v1: only support adding users who already have accounts (skip the invitation flow entirely).

---

### Step 7: Metric trends

**Why**: Owner/manager wants to see if metrics are going up or down for the selected date range.

**Approach**: Compare selected period vs previous period of same length.
- If user selects June 9–15 (7 days), compare against June 2–8
- Calculate sum/average per metric for both periods
- Show percentage change + up/down arrow

#### 7a. Trend calculation utility

**New file:** `lib/metrics/trends.ts`

```ts
type TrendResult = {
  current: number
  previous: number
  change: number      // absolute difference
  changePercent: number // percentage change
  direction: 'up' | 'down' | 'flat'
}

function calculateTrend(current: number, previous: number): TrendResult
```

#### 7b. Query for previous period data

**Files to change:** Wherever metric aggregations are fetched (dashboard, leaderboard, accountability, member profile), also fetch the same aggregation for the previous equivalent period.

This means:
- Dashboard KPI cards — show trend arrow + `+12%` or `-5%` badge
- Leaderboard — optional trend column
- Member profile key stats — trend per metric
- Department cards — trend per department metrics

#### 7c. UI: Trend badge component

**New file:** `components/ui/trend-badge.tsx`

Small reusable component:
- Green up arrow + percentage for positive trends
- Red down arrow + percentage for negative trends
- Gray dash for flat/no data
- "No trend data" text when previous period has no entries

---

## Execution Order Summary

| Step | What | Severity | Depends On |
|------|------|----------|------------|
| **1** | Persist settings JSON in metric actions | High | — |
| **2** | Expand METRIC_DATA_TYPES + labels | High | — |
| **3** | Add sub-option fields in create/edit modals | High | Steps 1 + 2 |
| **4** | Add unit labels in daily log inputs | Medium | — |
| **5** | Member deactivation (migration + actions + queries + UI) | High | — |
| **6** | Member creation/invitation (action + modal + optional invitations table) | High | Step 5 (should have is_active before adding members) |
| **7** | Metric trends (utility + queries + trend badge) | Medium | — |

Steps 1, 2, 4, 5 have no dependencies on each other and can be done in parallel.
Step 3 requires 1 + 2.
Step 6 should come after 5.
Step 7 is independent.
