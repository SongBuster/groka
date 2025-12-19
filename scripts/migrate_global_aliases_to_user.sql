-- Migrate existing global product aliases into a specific user's alias table
-- Usage:
--   1) Find your user id: select id from auth.users where email = 'you@example.com';
--   2) Run: select public.migrate_global_aliases_to_user('<your-user-uuid>');

begin;

create or replace function public.migrate_global_aliases_to_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert all existing aliases from products into per-user aliases
  -- Trim empty values and skip duplicates using the unique index
  insert into public.user_product_aliases (user_id, product_id, alias)
  select target_user_id, p.id, trim(a)
  from public.products p
  cross join unnest(coalesce(p.aliases, array[]::text[])) as a
  where trim(coalesce(a, '')) <> ''
    and not exists (
      select 1 from public.user_product_aliases ua
      where ua.user_id = target_user_id
        and ua.product_id = p.id
        and lower(ua.alias) = lower(trim(a))
    );
end;
$$;

comment on function public.migrate_global_aliases_to_user is 'Copies current global product aliases to the specified user''s alias table.';

commit;