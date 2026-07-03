# Supabase Setup

Explains how Supabase is used across the project. Actual provisioning happens
in Phase 7.

## Tables

- All tables described in `DATABASE_DESIGN.md` live in the Supabase PostgreSQL
  database.
- Managed via Prisma migrations (`prisma/`, `database/migrations`); Supabase
  is treated as a standard Postgres instance for schema purposes.
- `database/schema` holds human-readable schema documentation kept in sync
  with the Prisma schema.

## Storage

- Supabase Storage buckets mirror the `storage/` directory structure used in
  local development.
- Separate buckets planned for: source profile images, processed/derived
  images, and generated exports.
- Bucket access is private by default; signed URLs used for temporary access.

## Policies

- Row-Level Security (RLS) enabled on all tables containing personnel data.
- Policies scoped by role (see Authentication below) — read/write access is
  never open by default.
- Service role key used only in trusted server-side contexts (import
  pipeline, admin operations) — never exposed to the client.

## Authentication

- Supabase Auth for application user accounts.
- Roles anticipated: `admin`, `reviewer`, `viewer` (finalized in a later
  phase alongside RBAC, Phase 18).
- Client-side Supabase access always uses the anon/publishable key, scoped by
  RLS policies tied to the authenticated user's role.
