-- Migrate products.alias to products.aliases (text array)
-- This allows multiple aliases per product for better search and mapping

-- Step 1: Add new aliases column as text array
ALTER TABLE products
ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing alias data to aliases array
UPDATE products
SET aliases = CASE 
  WHEN alias IS NOT NULL AND alias != '' THEN ARRAY[alias]
  ELSE '{}'
END
WHERE aliases = '{}';

-- Step 3: Drop the old alias column (after data migration)
-- Uncomment when ready:
-- ALTER TABLE products DROP COLUMN alias;

-- Note: The old 'alias' column will be kept for now for backwards compatibility
-- After testing, it can be safely removed with: ALTER TABLE products DROP COLUMN alias;

COMMENT ON COLUMN products.aliases IS 'Array of alternative names/aliases for the product, used for flexible searching';
