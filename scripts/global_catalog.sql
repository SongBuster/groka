-- Global catalog tables + admin/user functions
-- This script defines a secure global repository and two functions:
-- 1) refresh_global_catalog_from_user(source_user_id uuid): ADMIN-ONLY (service_role)
--    Rebuilds the global catalog from a specific user's catalog.
-- 2) replace_user_catalog_with_global(): USER callable; replaces the current user's
--    products + categories with the global catalog (aliases excluded).

begin;

-- Global repository tables (no user_id)
create table if not exists public.global_catalog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  color text,
  keywords text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists global_catalog_categories_name_unique
  on public.global_catalog_categories (lower(name));

create table if not exists public.global_catalog_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists global_catalog_products_name_unique
  on public.global_catalog_products (lower(name));

-- ADMIN-ONLY function: refresh global repo from a specific user's catalog
create or replace function public.refresh_global_catalog_from_user(source_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  role text := coalesce(claims->>'role', '');
  is_admin boolean := false;
begin
  -- Allow service_role (API key) OR SQL editor superusers
  is_admin := (
    role = 'service_role'
    OR current_user in ('postgres', 'supabase_admin')
  );

  if not is_admin then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  -- Clear current global catalog
  truncate table public.global_catalog_products;
  truncate table public.global_catalog_categories;

  -- Copy categories from user's catalog
  insert into public.global_catalog_categories (name, description, icon, color, keywords, created_at, updated_at)
  select c.name, c.description, c.icon, c.color, c.keywords, now(), now()
  from public.categories c
  where c.user_id = source_user_id
  on conflict (lower(name)) do update set
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    keywords = excluded.keywords,
    updated_at = now();

  -- Copy products from user's catalog (without aliases)
  insert into public.global_catalog_products (name, category_name, created_at, updated_at)
  select p.name,
         (select cat.name from public.categories cat where cat.id = p.category_id and cat.user_id = source_user_id limit 1),
         now(),
         now()
  from public.products p
  where p.user_id = source_user_id
  on conflict (lower(name)) do update set
    category_name = excluded.category_name,
    updated_at = now();
end;
$$;

comment on function public.refresh_global_catalog_from_user is 'Admin-only: rebuilds global catalog from the given user. Accessible only with service_role.';

-- USER function: replace current user's catalog with global
create or replace function public.replace_user_catalog_with_global()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  uid uuid := (claims->>'sub')::uuid; -- auth.uid()
begin
  if uid is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  -- Remove current user's products first (to avoid FK issues), then categories
  delete from public.products where user_id = uid;
  delete from public.categories where user_id = uid;

  -- Insert categories from global
  insert into public.categories (user_id, name, description, icon, color, keywords, created_at, updated_at)
  select uid, gc.name, gc.description, gc.icon, gc.color, gc.keywords, now(), now()
  from public.global_catalog_categories gc
  on conflict (user_id, lower(name)) do update set
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    keywords = excluded.keywords,
    updated_at = now();

  -- Insert products from global, mapping category by name
  insert into public.products (user_id, name, aliases, category_id, review_status, last_reviewed_at, last_reviewed_by, created_at, updated_at)
  select uid,
         gp.name,
         null::text[],
         (
           select c.id from public.categories c
           where c.user_id = uid and lower(c.name) = lower(coalesce(gp.category_name, ''))
           limit 1
         ) as category_id,
         'reviewed',
         now(),
         uid,
         now(),
         now()
  from public.global_catalog_products gp
  on conflict (user_id, lower(name)) do update set
    category_id = excluded.category_id,
    review_status = excluded.review_status,
    last_reviewed_at = now(),
    last_reviewed_by = uid,
    updated_at = now();
end;
$$;

comment on function public.replace_user_catalog_with_global is 'User callable: replaces the current user\'s catalog with the global one (aliases excluded).';

commit;
