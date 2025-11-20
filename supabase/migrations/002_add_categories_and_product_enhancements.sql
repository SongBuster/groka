-- =====================================================
-- Migration: Add Categories and Product Enhancements
-- =====================================================

-- Create categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Emoji or icon name
  color TEXT, -- Color hex for UI
  keywords TEXT[], -- Array of keywords for auto-categorization
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add new columns to products table
ALTER TABLE products
  ADD COLUMN alias TEXT, -- Display name for shopping lists
  ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'uncategorized', 'reviewed')),
  ADD COLUMN last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN last_reviewed_by UUID REFERENCES auth.users(id),
  DROP COLUMN category; -- Remove old text category column

-- Create index for category lookups
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_review_status ON products(review_status);

-- Enable RLS on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Categories: Everyone can read, authenticated users can create
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert categories" ON categories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update categories" ON categories
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Add RLS policy for updating products (we only had SELECT and INSERT before)
CREATE POLICY "Authenticated users can update products" ON products
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Insert default categories
INSERT INTO categories (name, description, icon, color, keywords) VALUES
  ('Frutas y Verduras', 'Productos frescos', '🥬', '#22c55e', ARRAY['tomate', 'lechuga', 'manzana', 'plátano', 'naranja', 'patata', 'cebolla', 'zanahoria', 'pimiento', 'fruta', 'verdura']),
  ('Carnes y Pescados', 'Proteínas animales', '🥩', '#ef4444', ARRAY['pollo', 'ternera', 'cerdo', 'jamón', 'pavo', 'pescado', 'merluza', 'salmón', 'atún', 'carne']),
  ('Lácteos y Huevos', 'Productos lácteos', '🥛', '#f59e0b', ARRAY['leche', 'yogur', 'queso', 'mantequilla', 'nata', 'huevo', 'lácteo']),
  ('Pan y Bollería', 'Panadería y repostería', '🍞', '#d97706', ARRAY['pan', 'barra', 'baguette', 'bollo', 'croissant', 'magdalena', 'bizcocho']),
  ('Bebidas', 'Refrescos, zumos y bebidas', '🥤', '#3b82f6', ARRAY['agua', 'refresco', 'coca cola', 'fanta', 'zumo', 'cerveza', 'vino', 'bebida']),
  ('Despensa', 'Conservas y productos básicos', '🥫', '#8b5cf6', ARRAY['arroz', 'pasta', 'aceite', 'sal', 'azúcar', 'harina', 'legumbre', 'lata', 'conserva', 'garbanzos', 'lentejas']),
  ('Congelados', 'Productos congelados', '❄️', '#06b6d4', ARRAY['congelado', 'helado', 'pizza', 'croqueta']),
  ('Limpieza', 'Productos de limpieza', '🧹', '#84cc16', ARRAY['detergente', 'lejía', 'limpiador', 'fregasuelos', 'suavizante', 'limpieza']),
  ('Higiene Personal', 'Cuidado e higiene', '🧴', '#ec4899', ARRAY['champú', 'gel', 'jabón', 'pasta', 'cepillo', 'desodorante', 'higiene', 'cosmético']),
  ('Snacks y Dulces', 'Aperitivos y golosinas', '🍿', '#f97316', ARRAY['patatas', 'chips', 'chocolate', 'galleta', 'caramelo', 'chuchería', 'snack', 'aperitivo']),
  ('Otros', 'Productos sin categoría específica', '📦', '#6b7280', ARRAY[]);

-- Function to auto-categorize products based on keywords
CREATE OR REPLACE FUNCTION auto_categorize_product()
RETURNS TRIGGER AS $$
DECLARE
  cat RECORD;
  keyword TEXT;
  product_name_lower TEXT;
BEGIN
  -- Only auto-categorize if category is not set and status is pending
  IF NEW.category_id IS NULL AND NEW.review_status = 'pending' THEN
    product_name_lower := LOWER(NEW.name);
    
    -- Loop through categories and their keywords
    FOR cat IN 
      SELECT id, keywords 
      FROM categories 
      WHERE name != 'Otros'
      ORDER BY name
    LOOP
      -- Check if any keyword matches the product name
      FOREACH keyword IN ARRAY cat.keywords
      LOOP
        IF product_name_lower LIKE '%' || keyword || '%' THEN
          NEW.category_id := cat.id;
          EXIT; -- Exit inner loop
        END IF;
      END LOOP;
      
      -- If category was assigned, exit outer loop
      IF NEW.category_id IS NOT NULL THEN
        EXIT;
      END IF;
    END LOOP;
    
    -- If still no category, mark as uncategorized
    IF NEW.category_id IS NULL THEN
      NEW.review_status := 'uncategorized';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-categorization
CREATE TRIGGER trigger_auto_categorize_product
  BEFORE INSERT OR UPDATE OF name
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION auto_categorize_product();

-- Add updated_at trigger for categories
CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update function for products updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();
