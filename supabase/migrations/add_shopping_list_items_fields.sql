-- Add new fields to shopping_list_items table
ALTER TABLE shopping_list_items
ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3),
ADD COLUMN IF NOT EXISTS actual_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS estimated_price DECIMAL(10, 2);

-- Add comments for documentation
COMMENT ON COLUMN shopping_list_items.weight IS 'Weight in kg for products sold by weight';
COMMENT ON COLUMN shopping_list_items.actual_price IS 'Actual price paid per unit when shopping';
COMMENT ON COLUMN shopping_list_items.estimated_price IS 'Estimated price per unit based on last ticket price';
