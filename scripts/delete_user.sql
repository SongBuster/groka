-- Delete a user completely from the database (data + catalog tables)
-- Run in Supabase SQL editor as postgres/supabase_admin OR with service_role
-- Usage: replace 'user_uuid_here' and run the script.

begin;

-- Parameter: user to delete
do $$
declare
  target_user_id uuid := 'user_uuid_here'::uuid; -- <-- replace this
  v_products int;
  v_categories int;
  v_tickets int;
  v_items int;
  v_prices int;
begin
  -- Safety: ensure not null
  if target_user_id is null then
    raise exception 'target_user_id is null';
  end if;

  -- Delete ticket items (via tickets of the user)
  delete from public.ticket_items ti
  using public.tickets t
  where ti.ticket_id = t.id and t.user_id = target_user_id;
  GET DIAGNOSTICS v_items = ROW_COUNT;

  -- Delete tickets
  delete from public.tickets where user_id = target_user_id;
  GET DIAGNOSTICS v_tickets = ROW_COUNT;

  -- Delete product prices per supermarket
  delete from public.product_supermarkets ps
  using public.products p
  where ps.product_id = p.id and p.user_id = target_user_id;
  GET DIAGNOSTICS v_prices = ROW_COUNT;

  -- Delete products
  delete from public.products where user_id = target_user_id;
  GET DIAGNOSTICS v_products = ROW_COUNT;

  -- Delete categories
  delete from public.categories where user_id = target_user_id;
  GET DIAGNOSTICS v_categories = ROW_COUNT;

  raise notice 'Deleted user % => items: %, tickets: %, prices: %, products: %, categories: %',
    target_user_id, v_items, v_tickets, v_prices, v_products, v_categories;
end $$;

commit;

-- Note: This does NOT delete the user from Supabase Auth. To remove the auth user, delete it from
-- Dashboard > Auth > Users or via the Admin API with the service key:
-- supabase.auth.admin.deleteUser(user_id)
