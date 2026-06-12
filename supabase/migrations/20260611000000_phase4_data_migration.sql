-- Phase 4: Data Migration — Legacy → New Schema
-- Copies data from legacy/old tables into the Phase 1 tables.
-- Skips soft-deleted records (deleted_at IS NOT NULL).
-- Idempotent: uses ON CONFLICT DO NOTHING so re-running is safe.

BEGIN;

-- ============================================================
-- 0. Ensure Phase 3 schema changes are applied
--    (adds code column to metrics if not already present)
-- ============================================================

ALTER TABLE public.metrics ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_dept_code
  ON public.metrics (department_id, code)
  WHERE code IS NOT NULL AND is_active = true;

-- ============================================================
-- 1. companies → organizations
--    company_id → id, is_active → status, generate slug from name
-- ============================================================

INSERT INTO public.organizations (id, name, slug, timezone, status, created_at, updated_at)
SELECT
  c.company_id,
  c.name,
  -- Generate slug: lowercase, replace non-alphanum with hyphens, trim hyphens, append short id suffix for uniqueness
  LOWER(
    TRIM(BOTH '-' FROM
      REGEXP_REPLACE(
        REGEXP_REPLACE(LOWER(c.name), '[^a-z0-9]+', '-', 'g'),
        '-+', '-', 'g'
      )
    )
  ) || '-' || LEFT(c.company_id::text, 8) AS slug,
  c.timezone,
  CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END,
  c.created_at,
  c.updated_at
FROM public.companies c
WHERE c.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. legacy_profiles → profiles
--    user_id → id, name → full_name
--    Only migrate users that exist in auth.users (FK constraint)
-- ============================================================

INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
SELECT
  lp.user_id,
  lp.name,
  NULL,  -- no avatar_url in legacy
  lp.created_at,
  lp.updated_at
FROM public.legacy_profiles lp
WHERE lp.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = lp.user_id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. company_members → organization_members
--    company_id → organization_id
--    Note: legacy_profiles had company_id/role dropped by an earlier
--    migration, so we use company_members as the sole source.
-- ============================================================

INSERT INTO public.organization_members (organization_id, user_id, role, created_at, updated_at)
SELECT
  cm.company_id,
  cm.user_id,
  cm.role,
  cm.created_at,
  cm.updated_at
FROM public.company_members cm
WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = cm.company_id)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = cm.user_id)
ON CONFLICT ON CONSTRAINT uq_organization_members DO NOTHING;

-- ============================================================
-- 4. legacy_departments → departments
--    department_id → id, company_id → organization_id
--    Drops: type, deleted_at
-- ============================================================

INSERT INTO public.departments (id, organization_id, name, description, is_active, created_at, updated_at)
SELECT
  ld.department_id,
  ld.company_id,
  ld.name,
  NULL,  -- no description in legacy
  ld.is_active,
  ld.created_at,
  ld.updated_at
FROM public.legacy_departments ld
WHERE ld.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ld.company_id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. legacy_department_members → department_members
--    member_role → role, composite PK → generated uuid PK
--    Drops: is_active, deleted_at, start_date, end_date
-- ============================================================

INSERT INTO public.department_members (department_id, user_id, role, created_at, updated_at)
SELECT
  ldm.department_id,
  ldm.user_id,
  ldm.member_role,   -- values are already 'lead'/'member', matching new CHECK
  ldm.created_at,
  ldm.updated_at
FROM public.legacy_department_members ldm
WHERE ldm.deleted_at IS NULL
  AND ldm.is_active = true
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = ldm.department_id)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ldm.user_id)
ON CONFLICT ON CONSTRAINT uq_department_members DO NOTHING;

-- ============================================================
-- 6. legacy_metrics → metrics
--    metric_id → id, company_id → organization_id
--    data_type mapping: 'percent' → 'percentage'
--    Unsupported types (duration, datetime, selection, file) → 'text'
--    Drops: unit, settings, direction, input_mode, precision_scale, deleted_at
--    Adds: is_required = false, sort_order auto-numbered per department
-- ============================================================

INSERT INTO public.metrics (
  id, organization_id, department_id, name, code, description,
  data_type, is_required, sort_order, is_active, created_at, updated_at
)
SELECT
  lm.metric_id,
  lm.company_id,
  lm.department_id,
  lm.name,
  lm.code,
  lm.description,
  CASE lm.data_type
    WHEN 'percent'   THEN 'percentage'
    WHEN 'number'    THEN 'number'
    WHEN 'currency'  THEN 'currency'
    WHEN 'boolean'   THEN 'boolean'
    WHEN 'text'      THEN 'text'
    ELSE 'text'  -- duration, datetime, selection, file → text fallback
  END,
  false,  -- is_required: default to false (not in legacy)
  ROW_NUMBER() OVER (PARTITION BY lm.department_id ORDER BY lm.created_at) - 1,
  lm.is_active,
  lm.created_at,
  lm.updated_at
FROM public.legacy_metrics lm
WHERE lm.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = lm.company_id)
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = lm.department_id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. daily_entries → daily_reports
--    entry_id → id, company_id → organization_id,
--    entry_date → report_date
-- ============================================================

INSERT INTO public.daily_reports (
  id, organization_id, department_id, user_id,
  report_date, status, submitted_at, notes, created_at, updated_at
)
SELECT
  de.entry_id,
  de.company_id,
  de.department_id,
  de.user_id,
  de.entry_date,
  de.status,
  de.submitted_at,
  de.notes,
  de.created_at,
  de.updated_at
FROM public.daily_entries de
WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = de.company_id)
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = de.department_id)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = de.user_id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. entry_values → daily_report_values
--    entry_value_id → id, entry_id → daily_report_id,
--    value_numeric → value_number, value_bool → value_boolean
-- ============================================================

INSERT INTO public.daily_report_values (
  id, daily_report_id, metric_id,
  value_number, value_text, value_boolean,
  created_at, updated_at
)
SELECT
  ev.entry_value_id,
  ev.entry_id,
  ev.metric_id,
  ev.value_numeric,
  ev.value_text,
  ev.value_bool,
  ev.created_at,
  ev.updated_at
FROM public.entry_values ev
WHERE EXISTS (SELECT 1 FROM public.daily_reports dr WHERE dr.id = ev.entry_id)
  AND EXISTS (SELECT 1 FROM public.metrics m WHERE m.id = ev.metric_id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. Verification queries (advisory — check row counts)
-- ============================================================

DO $$
DECLARE
  v_orgs       bigint;
  v_profiles   bigint;
  v_org_mem    bigint;
  v_depts      bigint;
  v_dept_mem   bigint;
  v_metrics    bigint;
  v_reports    bigint;
  v_values     bigint;
BEGIN
  SELECT count(*) INTO v_orgs      FROM public.organizations;
  SELECT count(*) INTO v_profiles  FROM public.profiles;
  SELECT count(*) INTO v_org_mem   FROM public.organization_members;
  SELECT count(*) INTO v_depts     FROM public.departments;
  SELECT count(*) INTO v_dept_mem  FROM public.department_members;
  SELECT count(*) INTO v_metrics   FROM public.metrics;
  SELECT count(*) INTO v_reports   FROM public.daily_reports;
  SELECT count(*) INTO v_values    FROM public.daily_report_values;

  RAISE NOTICE '=== Phase 4 Data Migration Results ===';
  RAISE NOTICE 'organizations:       %', v_orgs;
  RAISE NOTICE 'profiles:            %', v_profiles;
  RAISE NOTICE 'organization_members: %', v_org_mem;
  RAISE NOTICE 'departments:         %', v_depts;
  RAISE NOTICE 'department_members:  %', v_dept_mem;
  RAISE NOTICE 'metrics:             %', v_metrics;
  RAISE NOTICE 'daily_reports:       %', v_reports;
  RAISE NOTICE 'daily_report_values: %', v_values;
END;
$$;

COMMIT;
