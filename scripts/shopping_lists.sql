-- Shopping lists schema (per-user)
-- Creates shopping_lists and shopping_list_items

begin;

-- Drop existing tables to ensure clean state
drop table if exists public.shopping_list_items cascade;
drop table if exists public.shopping_lists cascade;

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_lists_user_idx on public.shopping_lists(user_id);
create unique index shopping_lists_user_name_unique on public.shopping_lists(user_id, lower(name));

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,
  category_id uuid null references public.categories(id) on delete set null,
  name text not null,
  quantity numeric not null default 1,
  purchased boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_list_items_list_idx on public.shopping_list_items(list_id);
create index shopping_list_items_user_idx on public.shopping_list_items(user_id);
create index shopping_list_items_category_idx on public.shopping_list_items(category_id);

commit;
