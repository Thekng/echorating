-- Organization invitations table for the member creation flow.
-- When a user doesn't exist yet, an invitation record is created.
-- When they sign up and log in, the invitation is auto-accepted.

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  department_id   uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  invited_by      uuid NOT NULL REFERENCES public.profiles(id),
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_invitation UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_email
  ON public.organization_invitations (email);

-- RLS: service_role full access
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_invitations_service_all
  ON public.organization_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
