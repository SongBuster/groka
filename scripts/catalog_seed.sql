-- Snapshot and seed import for Mercadona catalog
-- Run this in Supabase SQL editor (or psql) to snapshot current data

begin;

-- 1) Seed tables (store the curated baseline)
create table if not exists public.catalog_seed_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  color text,
  keywords text[],
  original_category_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.catalog_seed_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[],
  category_name text,
  original_category_id uuid,
  original_product_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.catalog_seed_product_supermarkets (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  supermarket_name text,
  last_price numeric,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

-- 2) Refresh seed tables with current live data (idempotent snapshot)
truncate table public.catalog_seed_product_supermarkets;
truncate table public.catalog_seed_products;
truncate table public.catalog_seed_categories;

insert into public.catalog_seed_categories (name, description, icon, color, keywords, original_category_id)
select c.name, c.description, c.icon, c.color, c.keywords, c.id
from public.categories c;

insert into public.catalog_seed_products (name, aliases, category_name, original_category_id, original_product_id)
select p.name, p.aliases, c.name as category_name, p.category_id as original_category_id, p.id
from public.products p
left join public.categories c on c.id = p.category_id;

insert into public.catalog_seed_product_supermarkets (product_name, supermarket_name, last_price, last_seen_at)
select p.name as product_name, s.name as supermarket_name, ps.last_price, ps.last_seen_at
from public.product_supermarkets ps
join public.products p on p.id = ps.product_id
left join public.supermarkets s on s.id = ps.supermarket_id;

commit;

-- 3) Function to import the seed into live tables (idempotent)
create or replace function public.import_catalog_seed() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Categories: insert if name not already present (case-insensitive)
  insert into public.categories (name, description, icon, color, keywords, created_at, updated_at)
  select c.name, c.description, c.icon, c.color, c.keywords, now(), now()
  from public.catalog_seed_categories c
  where not exists (
    select 1 from public.categories existing
    where lower(existing.name) = lower(c.name)
  );

  -- Products: insert if name not already present (case-insensitive)
  insert into public.products (name, aliases, category_id, review_status, last_reviewed_at, last_reviewed_by, created_at, updated_at)
  select p.name,
         p.aliases,
         (
           select cat.id from public.categories cat
           where lower(cat.name) = lower(coalesce(p.category_name, ''))
           limit 1
         ) as category_id,
         'reviewed'::public.products_review_status,
         now(),
         'seed-import',
         now(),
         now()
  from public.catalog_seed_products p
  where not exists (
    select 1 from public.products existing
    where lower(existing.name) = lower(p.name)
  );

  -- Prices per supermarket: insert if missing for the (product, supermarket) pair
  insert into public.product_supermarkets (product_id, supermarket_id, last_price, last_seen_at, created_at)
  select prod.id,
         (
           select s.id from public.supermarkets s
           where lower(s.name) = lower(coalesce(ps.supermarket_name, ''))
           limit 1
         ) as supermarket_id,
         ps.last_price,
         coalesce(ps.last_seen_at, now()),
         now()
  from public.catalog_seed_product_supermarkets ps
  join public.products prod on lower(prod.name) = lower(ps.product_name)
  where not exists (
    select 1 from public.product_supermarkets existing
    where existing.product_id = prod.id
      and existing.supermarket_id = (
        select s.id from public.supermarkets s
        where lower(s.name) = lower(coalesce(ps.supermarket_name, ''))
        limit 1
      )
  );
end;
$$;

comment on function public.import_catalog_seed() is 'Imports Mercadona seed catalog into live tables; safe to run multiple times.';
