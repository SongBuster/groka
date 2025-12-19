-- Ensure user_id defaults to auth.uid() to avoid null inserts
-- Run once in Supabase SQL editor

begin;

alter table public.products alter column user_id set default auth.uid();
alter table public.categories alter column user_id set default auth.uid();

commit;
