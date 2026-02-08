-- Secure global catalog tables with RLS

alter table public.global_catalog_categories enable row level security;
alter table public.global_catalog_products enable row level security;

-- Read access for authenticated users
drop policy if exists "Allow authenticated read global catalog categories" on public.global_catalog_categories;
create policy "Allow authenticated read global catalog categories"
  on public.global_catalog_categories
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated read global catalog products" on public.global_catalog_products;
create policy "Allow authenticated read global catalog products"
  on public.global_catalog_products
  for select
  using (auth.role() = 'authenticated');

-- Write access only for service_role (admin tasks)
drop policy if exists "Allow service_role write global catalog categories" on public.global_catalog_categories;
create policy "Allow service_role write global catalog categories"
  on public.global_catalog_categories
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow service_role write global catalog products" on public.global_catalog_products;
create policy "Allow service_role write global catalog products"
  on public.global_catalog_products
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
