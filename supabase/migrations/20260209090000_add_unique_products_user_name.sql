-- Ensure upsert on (user_id, name) works for products
create unique index if not exists products_user_id_name_unique
  on public.products (user_id, name);
