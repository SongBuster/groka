-- Verify and fix tickets.user_id foreign key to reference auth.users(id)
-- Run in Supabase SQL editor as postgres/supabase_admin (or service_role)

-- 0) Inspect current FKs on tickets
select c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on c.conrelid = t.oid
where t.relname = 'tickets' and c.contype = 'f';

begin;

-- 1) Drop ALL FKs that involve tickets.user_id (regardless of the name)
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
    where t.relname = 'tickets' and a.attname = 'user_id' and c.contype = 'f'
  loop
    execute format('alter table public.tickets drop constraint %I', r.conname);
  end loop;
end $$;

-- 2) Recreate a single FK to auth.users(id)
alter table public.tickets
  add constraint tickets_user_id_auth_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

-- 3) Ensure default user_id to auth.uid() (optional, but useful)
alter table public.tickets alter column user_id set default auth.uid();

commit;

-- 4) Re-inspect FKs to confirm
select c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on c.conrelid = t.oid
where t.relname = 'tickets' and c.contype = 'f';

-- 5) (Optional) Check if a conflicting public.users exists
select schemaname, tablename from pg_tables where tablename = 'users';
-- If you see public.users and it's legacy, consider renaming it to avoid confusion:
-- alter table public.users rename to users_legacy;