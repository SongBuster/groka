-- Create per-user aliases table
begin;

create table if not exists public.user_product_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate alias per user/product (case-insensitive)
create unique index if not exists user_product_aliases_unique
  on public.user_product_aliases (user_id, product_id, lower(alias));

create index if not exists user_product_aliases_by_user
  on public.user_product_aliases (user_id);

create index if not exists user_product_aliases_by_product
  on public.user_product_aliases (product_id);

commit;
