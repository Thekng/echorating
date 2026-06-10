-- Phase 2: Auth, Onboarding & Membership
-- 1. Auto-create profile on signup via trigger
-- 2. provision_organization RPC for atomic onboarding

BEGIN;

-- ============================================================
-- 1. Auto-create profile on auth.users insert
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. provision_organization RPC
--    Atomically creates org + first location + owner membership.
--    Returns the new organization_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.provision_organization(
  p_user_id    uuid,
  p_name       text,
  p_slug       text,
  p_timezone   text DEFAULT 'UTC',
  p_industry   text DEFAULT NULL,
  p_location_name text DEFAULT 'Main'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Create organization
  INSERT INTO public.organizations (name, slug, timezone, industry)
  VALUES (p_name, p_slug, p_timezone, p_industry)
  RETURNING id INTO v_org_id;

  -- Create first location
  INSERT INTO public.locations (organization_id, name)
  VALUES (v_org_id, p_location_name);

  -- Add user as owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');

  RETURN v_org_id;
END;
$$;

COMMIT;
