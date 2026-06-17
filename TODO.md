# EchoRating — Remaining Work

## High Priority

### Member Management

- **Member deactivation**: Add `is_active` column to `organization_members`. Create deactivate/reactivate server actions. Deactivated members should be removed from departments and excluded from dashboard aggregations, daily log dropdowns, and leaderboards. Cannot deactivate yourself or the last owner.
- **Member invitation**: Replace the stub `createMemberAction` with a working flow. Accept email + role + optional department. Look up existing users by email; if not found, create an invitation record. Build the create member modal UI (email, role selector, department selector).
- **Invitation table**: Create `organization_invitations` table (organization_id, email, role, department_id, invited_by, accepted_at, created_at). Auto-add invited users to the org on signup. Simpler v1 alternative: only support adding users who already have accounts.

### Data Integrity

- **Stale metric data types**: Metrics created before the full data type support was added may have wrong `data_type` values (e.g. duration metrics saved as `text`). Need a one-time audit or migration script to flag/fix these.
- **Empty settings**: Metrics created before settings persistence (Step 1) have `settings: {}`. They work because `normalizeMetricSettings()` applies defaults server-side, but the edit modal should hydrate defaults visually so users see what's actually being used.

## Medium Priority

### Performance

- **Dashboard query optimization**: `getDashboardData()` runs many sequential Supabase queries. Batch independent queries with `Promise.all()` where possible. Consider database views or RPC functions for the heaviest aggregations as usage grows.
- **Recent logs query**: Now fetches values for all metrics per log entry. If a department has many metrics, this could get heavy. Monitor and add pagination or lazy-loading for metric columns if needed.

### Metric Trends (Investigation Step 7)

- **Trend calculation utility**: Compare selected period vs previous period of same length. Calculate sum/average per metric for both periods. Return percentage change + direction (up/down/flat).
- **Trend badge component**: Reusable UI component — green up arrow for positive, red down arrow for negative, gray dash for flat/no data.
- **Integration points**: Dashboard KPI cards, leaderboard, member profile key stats, department cards.

### Daily Log UX

- **Metric type indicators in table**: The recent logs table shows raw values but no context. Currency values should show the currency symbol, percentages should show `%`, durations should show the unit. The input form already has these (Step 4), but the table display doesn't.
- **Inline validation**: Validate metric values client-side before submission (e.g. number ranges, required fields, URL format for file metrics).

## Low Priority

### Cleanup

- **Remove unused history columns infrastructure**: `history-columns-config.tsx` component is no longer imported. The `department_log_key_metrics` table and `updateDepartmentLogKeyMetricsAction` action are unused. Can be deleted along with the related types (`DailyLogKeyMetricSlot`, `DailyLogKeyMetric`).
- **Remove unused types**: `DailyLogKeyMetricsActionState` and `INITIAL_DAILY_LOG_KEY_METRICS_STATE` in `features/daily-log/types.ts` are no longer needed.
- **Dashboard removed sections**: `DashboardDepartmentScore` and `DashboardMissingEntry` types are still exported from `features/dashboard/queries.ts` and the data is still fetched/computed server-side, even though the UI 
no longer renders them. Remove the dead code and queries to save on database calls.

### Future Considerations

- **Calculated metrics**: The `input_mode` field supports `manual` and presumably `calculated`. No UI or logic exists yet for calculated/formula-based metrics.
- **Export**: No way to export daily log data to CSV/Excel.
- **Notifications**: No reminders for agents who haven't submitted their daily log.
- **Audit log**: No record of who changed what and when (metric edits, member role changes, etc.).
