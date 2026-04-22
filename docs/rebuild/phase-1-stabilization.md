# Phase 1 Stabilization

This phase keeps the live product running while we remove the highest-risk data integrity problems that block a SaaS rebuild.

## Objective

Make tenant identity, membership, department assignment, and daily-log references internally consistent before broader architecture work continues.

Success means:

- every active department member also has an active `company_members` row
- every company owner is represented by `companies.owner_user_id` and an active `company_members.role='owner'`
- owner profile/auth identity drift is visible and repairable
- daily logs point to valid company + department + member combinations
- the audit can be rerun on demand against all tenants or one tenant

## Deliverables

- repeatable audit script: `scripts/audit-tenant-integrity.ts`
- run command: `npm run audit:tenant-integrity`
- scoped run: `npm run audit:tenant-integrity -- --company-id=<uuid>`
- CI/strict mode: `npm run audit:tenant-integrity -- --strict`

## Execution Order

1. Apply pending integrity migrations to the target environment.
2. Run the tenant audit across all companies.
3. Classify findings into:
   - `error`: data integrity bug that can break reads, writes, or scoring
   - `warning`: data drift that should be corrected before SaaS packaging
4. Fix every `error` issue with tenant-scoped SQL or migration-backed repairs.
5. Rerun the audit in `--strict` mode until all blockers are gone.
6. Only then move on to remaining Phase 1 write-path consolidation and score-pipeline hardening.

## Issue Types To Treat As Blockers

- `owner_missing_company_membership`
- `owner_membership_role_mismatch`
- `multiple_active_company_owners`
- `owner_missing_auth_user`
- `company_member_missing_profile`
- `department_member_missing_department`
- `department_member_missing_company_membership`
- `daily_entry_missing_department`
- `daily_entry_company_department_mismatch`
- `daily_entry_missing_company_membership`

These should be repaired before any wider refactor, because they produce broken screens, broken permissions, or invalid analytics.

## Warnings To Clean Up During Stabilization

- `company_contact_email_mismatch`
- `owner_profile_name_mismatch`
- `company_member_profile_inactive`
- `member_without_department_assignment`
- `active_member_on_inactive_department`
- `daily_entry_missing_department_membership`

Warnings do not always break the app immediately, but they increase support burden and make SaaS onboarding/billing less reliable.

## Operating Rules

- Prefer additive or repair migrations over destructive rewrites.
- Run tenant-scoped fixes first if the blast radius is unclear.
- Capture pre-fix and post-fix counts for memberships, department memberships, and daily entries.
- Keep `company_members` as the only company affiliation truth.
- Treat `profiles` as identity only.

## Immediate Follow-up After Audit Is Clean

1. Port all remaining department-assignment write paths to guarantee company membership creation.
2. Shadow-test daily score and leaderboard recomputation against live data.
3. Remove any remaining legacy triggers, functions, or reads that assume dropped profile columns.
4. Introduce a tenant health runbook for support and onboarding.
