-- Fix legacy global unique constraints to support per-user catalogs
-- Run this in Supabase SQL editor once.

begin;

-- Drop old global unique constraints (names may vary; these are defaults)
alter table public.categories drop constraint if exists categories_name_key;
alter table public.products drop constraint if exists products_name_key;

-- Ensure per-user unique indexes exist
create unique index if not exists categories_user_name_unique on public.categories (user_id, lower(name));
create unique index if not exists products_user_name_unique on public.products (user_id, lower(name));

commit;
