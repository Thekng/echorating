-- Add is_active column to organization_members for member deactivation.
-- Deactivated members are preserved for historical data but excluded from
-- daily log dropdowns, dashboard aggregations, and active member lists.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_org_members_is_active
  ON public.organization_members (organization_id, is_active)
  WHERE is_active = true;
