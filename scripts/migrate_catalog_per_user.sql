-- Migrate catalog to per-user ownership (products and categories)
-- Replace :owner_uuid with the target user id (provided: f53ee56b-653b-4d4d-9165-b5009a404d8f)

begin;

-- 1) Add user_id columns if missing
alter table public.categories add column if not exists user_id uuid;
alter table public.products add column if not exists user_id uuid;

-- 2) Backfill existing rows to the owner user
update public.categories set user_id = 'f53ee56b-653b-4d4d-9165-b5009a404d8f' where user_id is null;
update public.products set user_id = 'f53ee56b-653b-4d4d-9165-b5009a404d8f' where user_id is null;

-- 3) Enforce NOT NULL
alter table public.categories alter column user_id set not null;
alter table public.products alter column user_id set not null;

-- 4) Unique constraints per user
-- Drop legacy global unique constraints if they exist
alter table public.categories drop constraint if exists categories_name_key;
alter table public.products drop constraint if exists products_name_key;

-- Create per-user unique indexes
create unique index if not exists categories_user_name_unique on public.categories (user_id, lower(name));
create unique index if not exists products_user_name_unique on public.products (user_id, lower(name));

-- 5) Drop per-user alias table (no longer used)
drop table if exists public.user_product_aliases cascade;

commit;
