-- Fix replace_user_catalog_with_global RPC to remove enum cast
-- The enum type public.products_review_status doesn't exist; use text 'reviewed' instead.

begin;

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

comment on function public.replace_user_catalog_with_global is 'User callable: replaces the current user''s catalog with the global one (aliases excluded).';

commit;
