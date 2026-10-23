-- Wedding invitations: private writes, public reads only through the Edge Function.
-- Existing public.invitations table is kept; no broad RLS policies are added.
-- The Edge Function uses the server-side service role key and returns only a single invitation by slug.

alter table public.invitations
  add column if not exists is_published boolean not null default true;

create index if not exists invitations_slug_idx on public.invitations (slug);

-- RLS stays enabled. Do not add anon INSERT/UPDATE/SELECT policies.
