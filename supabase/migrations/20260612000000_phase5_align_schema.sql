-- Phase 5: Align Schema + Code
-- Adds missing columns to new metrics table (unit, settings, input_mode)
-- Rewrites RPCs to use new tables (daily_reports, daily_report_values)
-- Updates FKs on department_log_key_metrics and calculated_values

BEGIN;

-- ============================================================
-- 1. Add missing columns to metrics table
-- ============================================================

ALTER TABLE public.metrics ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.metrics ADD COLUMN IF NOT EXISTS settings jsonb;
ALTER TABLE public.metrics ADD COLUMN IF NOT EXISTS input_mode text NOT NULL DEFAULT 'manual'
  CHECK (input_mode IN ('manual', 'calculated'));

-- Backfill from legacy_metrics where possible
UPDATE public.metrics m
SET
  unit       = COALESCE(m.unit, lm.unit),
  settings   = COALESCE(m.settings, lm.settings),
  input_mode = COALESCE(
    CASE WHEN m.input_mode = 'manual' AND lm.input_mode IS NOT NULL THEN lm.input_mode ELSE m.input_mode END,
    'manual'
  )
FROM public.legacy_metrics lm
WHERE lm.metric_id = m.id
  AND (m.unit IS NULL OR m.settings IS NULL);

-- Expand data_type check constraint to include all legacy types
ALTER TABLE public.metrics DROP CONSTRAINT IF EXISTS metrics_data_type_check;
ALTER TABLE public.metrics ADD CONSTRAINT metrics_data_type_check
  CHECK (data_type IN ('number', 'currency', 'percentage', 'percent', 'boolean', 'text', 'duration', 'datetime', 'selection', 'file'));

-- ============================================================
-- 2. Rewrite save_daily_log_entry RPC for new tables
-- ============================================================

DROP FUNCTION IF EXISTS public.save_daily_log_entry(uuid,uuid,uuid,uuid,date,text,timestamptz,text,jsonb);

CREATE OR REPLACE FUNCTION public.save_daily_log_entry(
  p_report_id     uuid,        -- null -> insert, non-null -> update by id
  p_organization_id uuid,
  p_department_id uuid,
  p_user_id       uuid,
  p_report_date   date,
  p_status        text,
  p_submitted_at  timestamptz,
  p_notes         text,
  p_values        jsonb        -- [{metric_id, value_number, value_text, value_boolean}, ...]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id uuid;
BEGIN
  -- 1. Entry upsert
  IF p_report_id IS NOT NULL THEN
    UPDATE daily_reports SET
      report_date  = p_report_date,
      status       = p_status,
      submitted_at = p_submitted_at,
      notes        = p_notes,
      updated_at   = now()
    WHERE id = p_report_id
      AND organization_id = p_organization_id
    RETURNING id INTO v_report_id;

    IF v_report_id IS NULL THEN
      RAISE EXCEPTION 'Entry not found or does not belong to this organization.';
    END IF;
  ELSE
    INSERT INTO daily_reports (
      organization_id, department_id, user_id, report_date,
      status, submitted_at, notes, updated_at
    ) VALUES (
      p_organization_id, p_department_id, p_user_id, p_report_date,
      p_status, p_submitted_at, p_notes, now()
    )
    ON CONFLICT (user_id, department_id, report_date)
    DO UPDATE SET
      status       = EXCLUDED.status,
      submitted_at = EXCLUDED.submitted_at,
      notes        = EXCLUDED.notes,
      updated_at   = now()
    RETURNING id INTO v_report_id;
  END IF;

  -- 2. Clear old values for clean slate
  DELETE FROM daily_report_values WHERE daily_report_id = v_report_id;

  -- Also clear legacy calculated_values if table exists
  BEGIN
    DELETE FROM calculated_values WHERE entry_id = v_report_id;
  EXCEPTION WHEN undefined_table THEN
    -- calculated_values may not exist yet, skip
  END;

  -- 3. Insert new manual values
  IF p_values IS NOT NULL AND jsonb_array_length(p_values) > 0 THEN
    INSERT INTO daily_report_values (
      daily_report_id, metric_id, value_number, value_text, value_boolean
    )
    SELECT
      v_report_id,
      (v->>'metric_id')::uuid,
      (v->>'value_number')::numeric,
      NULLIF(v->>'value_text', ''),
      (v->>'value_boolean')::boolean
    FROM jsonb_array_elements(p_values) AS v;
  END IF;

  RETURN v_report_id;
END;
$$;

-- ============================================================
-- 3. Rewrite save_department_key_metrics RPC for new tables
-- ============================================================

DROP FUNCTION IF EXISTS public.save_department_key_metrics(uuid,uuid,jsonb);

CREATE OR REPLACE FUNCTION public.save_department_key_metrics(
  p_organization_id uuid,
  p_department_id   uuid,
  p_slots           jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: ensure the department belongs to the calling organization
  IF NOT EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.id = p_department_id
      AND d.organization_id = p_organization_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Department not found or inactive.';
  END IF;

  -- Clear + repopulate atomically
  DELETE FROM public.department_log_key_metrics
  WHERE department_id = p_department_id;

  IF p_slots IS NOT NULL AND jsonb_array_length(p_slots) > 0 THEN
    INSERT INTO public.department_log_key_metrics (department_id, slot, metric_id)
    SELECT
      p_department_id,
      (s->>'slot')::smallint,
      (s->>'metric_id')::uuid
    FROM jsonb_array_elements(p_slots) AS s
    WHERE s->>'metric_id' IS NOT NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_department_key_metrics(uuid, uuid, jsonb) TO service_role;

-- ============================================================
-- 4. Update enqueue_calculated_recompute_job RPC if it exists
-- ============================================================

-- Recreate with new parameter names
DROP FUNCTION IF EXISTS public.enqueue_calculated_recompute_job(uuid,uuid,uuid);

CREATE OR REPLACE FUNCTION public.enqueue_calculated_recompute_job(
  p_report_id     uuid,
  p_organization_id uuid,
  p_department_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.calculated_value_jobs (
    entry_id, company_id, department_id, status, attempts, created_at
  ) VALUES (
    p_report_id, p_organization_id, p_department_id, 'pending', 0, now()
  )
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN undefined_table THEN
  -- Table may not exist, silently skip
END;
$$;

-- ============================================================
-- 5. Service role full access on new tables
-- ============================================================

-- Ensure service_role has full access to new tables for admin client queries
DROP POLICY IF EXISTS daily_reports_service_all ON public.daily_reports;
CREATE POLICY daily_reports_service_all ON public.daily_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS daily_report_values_service_all ON public.daily_report_values;
CREATE POLICY daily_report_values_service_all ON public.daily_report_values
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS metrics_service_all ON public.metrics;
CREATE POLICY metrics_service_all ON public.metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS departments_service_all ON public.departments;
CREATE POLICY departments_service_all ON public.departments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS department_members_service_all ON public.department_members;
CREATE POLICY department_members_service_all ON public.department_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_service_all ON public.audit_logs;
CREATE POLICY audit_logs_service_all ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
