-- Phase 4b: Sync app_metadata for migrated users
-- Sets active_organization_id and active_role in auth.users.raw_app_meta_data
-- for every user that has an organization_members row but no active_organization_id yet.
-- For users with exactly 1 membership, auto-selects it.
-- For users with multiple memberships, picks the first (by created_at).
-- Idempotent: skips users who already have active_organization_id set.

-- NOTE: This directly updates auth.users.raw_app_meta_data because
-- Supabase stores app_metadata in that JSONB column.
-- The service role has access to auth schema.

BEGIN;

-- Update users who have organization memberships but no active_organization_id in app_metadata
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'active_organization_id', sub.organization_id,
    'active_role', sub.role
  )
FROM (
  -- For each user, pick the membership to activate:
  -- If only 1 membership → use it. If multiple → pick earliest created.
  SELECT DISTINCT ON (om.user_id)
    om.user_id,
    om.organization_id,
    om.role
  FROM public.organization_members om
  ORDER BY om.user_id, om.created_at ASC
) sub
WHERE u.id = sub.user_id
  AND (
    -- Only update if not already set
    u.raw_app_meta_data IS NULL
    OR u.raw_app_meta_data ->> 'active_organization_id' IS NULL
    OR u.raw_app_meta_data ->> 'active_organization_id' = ''
  );

-- Verification: count users with active_organization_id set
DO $$
DECLARE
  v_total_members bigint;
  v_synced bigint;
  v_missing bigint;
BEGIN
  SELECT count(DISTINCT user_id) INTO v_total_members FROM public.organization_members;

  SELECT count(*) INTO v_synced
  FROM auth.users
  WHERE raw_app_meta_data ->> 'active_organization_id' IS NOT NULL
    AND raw_app_meta_data ->> 'active_organization_id' != '';

  v_missing := v_total_members - v_synced;

  RAISE NOTICE '=== Phase 4b: User Claims Sync Results ===';
  RAISE NOTICE 'Total org members:    %', v_total_members;
  RAISE NOTICE 'Users with claims:    %', v_synced;
  RAISE NOTICE 'Users still missing:  %', v_missing;
END;
$$;

COMMIT;
