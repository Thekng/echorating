-- Migration: Add time tracking metrics to departments
-- Purpose: Enable agents to track time in HH:MM:SS format without conflicts
-- Date: 2026-02-16

BEGIN;

-- 1. Add common time metrics to all active departments
-- These will be used for tracking talk time, break time, etc.

INSERT INTO public.metrics (
  company_id,
  department_id,
  name,
  code,
  description,
  data_type,
  unit,
  direction,
  input_mode,
  precision_scale,
  is_active
)
SELECT
  d.company_id,
  d.department_id,
  'Talk Time',
  'talk_time',
  'Total time spent on customer calls (HH:MM:SS)',
  'duration',
  'seconds',
  'higher_is_better',
  'manual',
  0,
  true
FROM public.departments d
WHERE d.is_active = true
  AND d.deleted_at is null
  AND NOT EXISTS (
    SELECT 1
    FROM public.metrics m
    WHERE m.company_id = d.company_id
      AND m.department_id = d.department_id
      AND m.code = 'talk_time'
      AND m.deleted_at is null
  )
ON CONFLICT DO NOTHING;

-- 2. Add break time metric
INSERT INTO public.metrics (
  company_id,
  department_id,
  name,
  code,
  description,
  data_type,
  unit,
  direction,
  input_mode,
  precision_scale,
  is_active
)
SELECT
  d.company_id,
  d.department_id,
  'Break Time',
  'break_time',
  'Total time spent on breaks (HH:MM:SS)',
  'duration',
  'seconds',
  'lower_is_better',
  'manual',
  0,
  true
FROM public.departments d
WHERE d.is_active = true
  AND d.deleted_at is null
  AND NOT EXISTS (
    SELECT 1
    FROM public.metrics m
    WHERE m.company_id = d.company_id
      AND m.department_id = d.department_id
      AND m.code = 'break_time'
      AND m.deleted_at is null
  )
ON CONFLICT DO NOTHING;

-- 3. Add after-call-work time metric
INSERT INTO public.metrics (
  company_id,
  department_id,
  name,
  code,
  description,
  data_type,
  unit,
  direction,
  input_mode,
  precision_scale,
  is_active
)
SELECT
  d.company_id,
  d.department_id,
  'After-Call Work',
  'after_call_work',
  'Time spent on follow-up work after calls (HH:MM:SS)',
  'duration',
  'seconds',
  'lower_is_better',
  'manual',
  0,
  true
FROM public.departments d
WHERE d.is_active = true
  AND d.deleted_at is null
  AND NOT EXISTS (
    SELECT 1
    FROM public.metrics m
    WHERE m.company_id = d.company_id
      AND m.department_id = d.department_id
      AND m.code = 'after_call_work'
      AND m.deleted_at is null
  )
ON CONFLICT DO NOTHING;

-- 4. Create calculated metric for availability (Total Time - Talk Time - Break Time)
-- This metric demonstrates how time values can be calculated from other metrics

INSERT INTO public.metrics (
  company_id,
  department_id,
  name,
  code,
  description,
  data_type,
  unit,
  direction,
  input_mode,
  precision_scale,
  is_active
)
SELECT
  d.company_id,
  d.department_id,
  'Available Time',
  'available_time',
  'Time available for work (calculated) = Working Hours - Talk Time - Break Time',
  'duration',
  'seconds',
  'higher_is_better',
  'calculated',
  0,
  true
FROM public.departments d
WHERE d.is_active = true
  AND d.deleted_at is null
  AND NOT EXISTS (
    SELECT 1
    FROM public.metrics m
    WHERE m.company_id = d.company_id
      AND m.department_id = d.department_id
      AND m.code = 'available_time'
      AND m.deleted_at is null
  )
ON CONFLICT DO NOTHING;

-- 5. Create index for efficient time metric lookups
CREATE INDEX IF NOT EXISTS idx_metrics_data_type_duration
  ON public.metrics (company_id, department_id, data_type)
  WHERE data_type = 'duration' AND deleted_at IS NULL;

-- 6. Add documentation comment about time tracking
COMMENT ON COLUMN public.metrics.data_type IS 
  'Data type of metric value. Duration: stored as integer seconds, input as HH:MM:SS';

COMMENT ON COLUMN public.entry_values.value_numeric IS 
  'Numeric value. For duration metrics, this is seconds (convert from HH:MM:SS on input)';

-- 7. Verify time metrics were created
SELECT 
  d.name as department_name,
  COUNT(m.metric_id) as time_metrics_count,
  STRING_AGG(m.name, ', ') as time_metrics
FROM public.departments d
LEFT JOIN public.metrics m ON d.department_id = m.department_id 
  AND m.data_type = 'duration' 
  AND m.deleted_at IS NULL
WHERE d.is_active = true 
  AND d.deleted_at IS NULL
GROUP BY d.department_id, d.name
ORDER BY d.name;

COMMIT;

-- Rollback script (if needed):
-- BEGIN;
-- DELETE FROM public.metrics 
-- WHERE code IN ('talk_time', 'break_time', 'after_call_work', 'available_time')
--   AND deleted_at IS NULL;
-- COMMIT;
