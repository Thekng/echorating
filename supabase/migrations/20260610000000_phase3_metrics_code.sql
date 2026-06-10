ALTER TABLE public.metrics ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_dept_code
  ON public.metrics (department_id, code)
  WHERE code IS NOT NULL AND is_active = true;
