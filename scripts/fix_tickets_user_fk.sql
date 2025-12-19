-- Fix tickets.user_id foreign key to reference Supabase auth.users
-- Also set default user_id to auth.uid() to prevent null inserts

begin;

-- 1) Drop legacy FK (likely pointing to public.users)
alter table public.tickets drop constraint if exists tickets_user_id_fkey;

-- 2) Recreate FK to auth.users(id)
alter table public.tickets
  add constraint tickets_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

-- 3) Ensure default user_id comes from the authenticated user
alter table public.tickets alter column user_id set default auth.uid();

commit;
