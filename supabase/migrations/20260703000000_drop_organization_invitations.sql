-- Drop the organization_invitations table — member addition is now direct only.
-- Members must already have an account; there is no invitation flow.

drop table if exists organization_invitations;
