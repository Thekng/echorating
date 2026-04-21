-- Add is_active to company_members so membership status is per-company,
-- not a global flag on profiles.

ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill from profiles: if a profile is inactive, mark all their memberships inactive.
UPDATE public.company_members cm
SET is_active = p.is_active
FROM public.profiles p
WHERE cm.user_id = p.user_id
  AND p.is_active = false;

-- Index for quickly filtering active members of a company.
CREATE INDEX IF NOT EXISTS idx_company_members_active
  ON public.company_members (company_id, is_active)
  WHERE is_active = true;
