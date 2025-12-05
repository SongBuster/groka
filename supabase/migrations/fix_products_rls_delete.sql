-- Fix RLS policies for products table to allow DELETE operations
-- Run this migration to ensure authenticated users can delete products

-- First, check if RLS is enabled, and enable it if needed
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.products;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.products;

-- Create a policy that allows authenticated users to delete any product
CREATE POLICY "Allow authenticated users to delete products"
ON public.products
FOR DELETE
USING (auth.role() = 'authenticated');

-- Ensure SELECT policy exists for reading
CREATE POLICY IF NOT EXISTS "Allow public to read products"
ON public.products
FOR SELECT
USING (true);

-- Ensure INSERT policy exists
CREATE POLICY IF NOT EXISTS "Allow authenticated users to insert products"
ON public.products
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Ensure UPDATE policy exists
CREATE POLICY IF NOT EXISTS "Allow authenticated users to update products"
ON public.products
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
