-- Phase 1: Database Foundation (Rebuild)
-- Creates 10 new tables for the rebuilt EchoRating schema.
-- Renames 4 conflicting tables (profiles, departments, department_members, metrics)
-- to legacy_* before creating their replacements.

BEGIN;

-- ============================================================
-- 0. Rename conflicting tables to legacy_*
--    ALTER TABLE ... RENAME cascades FK references automatically.
-- ============================================================

ALTER TABLE IF EXISTS public.profiles          RENAME TO legacy_profiles;
ALTER TABLE IF EXISTS public.departments       RENAME TO legacy_departments;
ALTER TABLE IF EXISTS public.department_members RENAME TO legacy_department_members;
ALTER TABLE IF EXISTS public.metrics           RENAME TO legacy_metrics;

-- Rename triggers on legacy tables to avoid name collisions
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['legacy_profiles','legacy_departments','legacy_department_members','legacy_metrics']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'set_updated_at'
        AND tgrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format('ALTER TRIGGER set_updated_at ON public.%I RENAME TO legacy_set_updated_at', t);
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 1. updated_at trigger function (already exists, safe to replace)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. organizations (replaces companies)
-- ============================================================

CREATE TABLE public.organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  industry    text,
  timezone    text NOT NULL DEFAULT 'UTC',
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug   ON public.organizations (slug);
CREATE INDEX idx_organizations_status ON public.organizations (status);

-- ============================================================
-- 3. locations (NEW — did not exist before)
-- ============================================================

CREATE TABLE public.locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  address         text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_organization_id ON public.locations (organization_id);

-- ============================================================
-- 4. profiles (replaces legacy_profiles)
-- ============================================================

CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. organization_members (replaces company_members)
-- ============================================================

CREATE TABLE public.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_organization_members UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_organization_id ON public.organization_members (organization_id);
CREATE INDEX idx_org_members_user_id         ON public.organization_members (user_id);
CREATE INDEX idx_org_members_role            ON public.organization_members (role);

-- ============================================================
-- 6. departments (replaces legacy_departments)
-- ============================================================

CREATE TABLE public.departments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name            text NOT NULL,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_departments_organization_id ON public.departments (organization_id);
CREATE INDEX idx_departments_location_id     ON public.departments (location_id);

-- ============================================================
-- 7. department_members (replaces legacy_department_members)
-- ============================================================

CREATE TABLE public.department_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'member'
                  CHECK (role IN ('lead', 'member')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_department_members UNIQUE (department_id, user_id)
);

CREATE INDEX idx_dept_members_department_id ON public.department_members (department_id);
CREATE INDEX idx_dept_members_user_id       ON public.department_members (user_id);

-- ============================================================
-- 8. metrics (replaces legacy_metrics)
-- ============================================================

CREATE TABLE public.metrics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id   uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  data_type       text NOT NULL DEFAULT 'number'
                    CHECK (data_type IN ('number', 'currency', 'percentage', 'boolean', 'text')),
  is_required     boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_metrics_organization_id ON public.metrics (organization_id);
CREATE INDEX idx_metrics_department_id   ON public.metrics (department_id);

-- ============================================================
-- 9. daily_reports (replaces daily_entries)
-- ============================================================

CREATE TABLE public.daily_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id   uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id     uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  report_date     date NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted')),
  submitted_at    timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_daily_reports UNIQUE (user_id, department_id, report_date)
);

CREATE INDEX idx_daily_reports_organization_id ON public.daily_reports (organization_id);
CREATE INDEX idx_daily_reports_report_date     ON public.daily_reports (report_date);
CREATE INDEX idx_daily_reports_user_id         ON public.daily_reports (user_id);
CREATE INDEX idx_daily_reports_department_id   ON public.daily_reports (department_id);
CREATE INDEX idx_daily_reports_location_id     ON public.daily_reports (location_id);

-- ============================================================
-- 10. daily_report_values (replaces entry_values)
-- ============================================================

CREATE TABLE public.daily_report_values (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  metric_id       uuid NOT NULL REFERENCES public.metrics(id) ON DELETE CASCADE,
  value_number    numeric,
  value_text      text,
  value_boolean   boolean,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_daily_report_values UNIQUE (daily_report_id, metric_id)
);

CREATE INDEX idx_daily_report_values_report_id ON public.daily_report_values (daily_report_id);
CREATE INDEX idx_daily_report_values_metric_id ON public.daily_report_values (metric_id);

-- ============================================================
-- 11. audit_logs (replaces action_events)
-- ============================================================

CREATE TABLE public.audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs (organization_id);
CREATE INDEX idx_audit_logs_user_id         ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_action          ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_entity          ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at      ON public.audit_logs (created_at);

-- ============================================================
-- 12. Enable RLS on all new tables
-- ============================================================

ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. Basic RLS policies (authenticated + org isolation)
-- ============================================================

-- profiles: users can read all profiles, but only update their own
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- organizations: members can see their own orgs
CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY organizations_insert ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- organization_members: members can see fellow members in their orgs
CREATE POLICY org_members_select ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY org_members_insert ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
    OR
    -- Allow first member (org creator) to add themselves
    NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_members.organization_id
    )
  );

CREATE POLICY org_members_update ON public.organization_members
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_members_delete ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Helper: org-isolation macro via membership
-- Used by locations, departments, metrics, daily_reports, audit_logs

-- locations
CREATE POLICY locations_select ON public.locations
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY locations_insert ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY locations_update ON public.locations
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- departments
CREATE POLICY departments_select ON public.departments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY departments_insert ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY departments_update ON public.departments
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- department_members
CREATE POLICY dept_members_select ON public.department_members
  FOR SELECT TO authenticated
  USING (
    department_id IN (
      SELECT d.id FROM public.departments d
      JOIN public.organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY dept_members_insert ON public.department_members
  FOR INSERT TO authenticated
  WITH CHECK (
    department_id IN (
      SELECT d.id FROM public.departments d
      JOIN public.organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY dept_members_update ON public.department_members
  FOR UPDATE TO authenticated
  USING (
    department_id IN (
      SELECT d.id FROM public.departments d
      JOIN public.organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY dept_members_delete ON public.department_members
  FOR DELETE TO authenticated
  USING (
    department_id IN (
      SELECT d.id FROM public.departments d
      JOIN public.organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- metrics
CREATE POLICY metrics_select ON public.metrics
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY metrics_insert ON public.metrics
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY metrics_update ON public.metrics
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- daily_reports
CREATE POLICY daily_reports_select ON public.daily_reports
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY daily_reports_insert ON public.daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY daily_reports_update ON public.daily_reports
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- daily_report_values
CREATE POLICY report_values_select ON public.daily_report_values
  FOR SELECT TO authenticated
  USING (
    daily_report_id IN (
      SELECT dr.id FROM public.daily_reports dr
      JOIN public.organization_members om ON om.organization_id = dr.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY report_values_insert ON public.daily_report_values
  FOR INSERT TO authenticated
  WITH CHECK (
    daily_report_id IN (
      SELECT id FROM public.daily_reports
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY report_values_update ON public.daily_report_values
  FOR UPDATE TO authenticated
  USING (
    daily_report_id IN (
      SELECT id FROM public.daily_reports
      WHERE user_id = auth.uid()
    )
  );

-- audit_logs: org members can read, system inserts (use service role for writes)
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 14. Apply updated_at triggers to all tables with updated_at
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.department_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.daily_report_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- audit_logs has no updated_at (append-only)

COMMIT;
