-- Remove the single alias column from products table
-- Since we now use aliases array, this column is redundant
ALTER TABLE public.products
DROP COLUMN IF EXISTS alias;
