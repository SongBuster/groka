-- =====================================================
-- Migración: Añadir tabla de supermercados
-- Fecha: 2025-11-21
-- =====================================================

-- 1. Crear tabla de supermercados
CREATE TABLE IF NOT EXISTS supermarkets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  nif TEXT UNIQUE, -- NIF del supermercado (ej: A-46103834 para Mercadona)
  logo_url TEXT, -- URL del logo
  color TEXT, -- Color de marca (ej: #00A651 para Mercadona)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Insertar supermercados conocidos
INSERT INTO supermarkets (name, nif, color) VALUES
  ('Mercadona', 'A-46103834', '#00A651'),
  ('Carrefour', 'A-28297059', '#0057A0'),
  ('Lidl', 'A-79497774', '#0050AA'),
  ('Aldi', 'A-79092823', '#00A4E4'),
  ('Dia', 'A-28164754', '#E2001A'),
  ('Alcampo', 'A-28738415', '#0072BC'),
  ('Eroski', 'A-20034409', '#E30613')
ON CONFLICT (name) DO NOTHING;

-- 3. Añadir columna supermarket_id a tickets
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS supermarket_id UUID REFERENCES supermarkets(id);

-- 4. Crear índice para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_tickets_supermarket_id ON tickets(supermarket_id);

-- 5. Migrar tickets existentes a Mercadona (asumiendo que todos los existentes son de Mercadona)
UPDATE tickets 
SET supermarket_id = (SELECT id FROM supermarkets WHERE name = 'Mercadona')
WHERE supermarket_id IS NULL;

-- 6. Añadir columna supermarket_id a products (relación many-to-many)
-- Primero crear tabla intermedia para productos-supermercados
CREATE TABLE IF NOT EXISTS product_supermarkets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
  last_price DECIMAL(10, 2), -- Último precio en este supermercado
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, supermarket_id)
);

CREATE INDEX IF NOT EXISTS idx_product_supermarkets_product ON product_supermarkets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_supermarkets_supermarket ON product_supermarkets(supermarket_id);

-- 7. Migrar productos existentes (asociarlos a Mercadona por defecto)
INSERT INTO product_supermarkets (product_id, supermarket_id)
SELECT DISTINCT p.id, s.id
FROM products p
CROSS JOIN supermarkets s
WHERE s.name = 'Mercadona'
ON CONFLICT (product_id, supermarket_id) DO NOTHING;

-- 8. Añadir columna supermarket_id a shopping_lists (futuro)
ALTER TABLE shopping_lists 
ADD COLUMN IF NOT EXISTS supermarket_id UUID REFERENCES supermarkets(id);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_supermarket_id ON shopping_lists(supermarket_id);

-- =====================================================
-- RLS Policies para supermarkets
-- =====================================================

-- Habilitar RLS
ALTER TABLE supermarkets ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_supermarkets ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer supermercados (son públicos)
CREATE POLICY "Everyone can read supermarkets"
ON supermarkets FOR SELECT
TO authenticated
USING (true);

-- Solo admins pueden modificar supermercados (por ahora nadie)
CREATE POLICY "Only admins can modify supermarkets"
ON supermarkets FOR ALL
TO authenticated
USING (false);

-- Políticas para product_supermarkets
CREATE POLICY "Users can view product-supermarket relations"
ON product_supermarkets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert product-supermarket relations"
ON product_supermarkets FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update product-supermarket relations"
ON product_supermarkets FOR UPDATE
TO authenticated
USING (true);

-- =====================================================
-- Función para actualizar updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_supermarket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_supermarkets_updated_at
  BEFORE UPDATE ON supermarkets
  FOR EACH ROW
  EXECUTE FUNCTION update_supermarket_updated_at();

-- =====================================================
-- Comentarios
-- =====================================================

COMMENT ON TABLE supermarkets IS 'Catálogo de supermercados';
COMMENT ON TABLE product_supermarkets IS 'Relación many-to-many entre productos y supermercados';
COMMENT ON COLUMN supermarkets.nif IS 'NIF único del supermercado para identificación automática';
COMMENT ON COLUMN product_supermarkets.last_price IS 'Último precio conocido del producto en este supermercado';
