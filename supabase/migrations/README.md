# Migraciones de Supabase

## Migraciones Pendientes

### 1. `add_shopping_list_items_fields.sql`
Añade campos para soportar peso y precio real en los items de las listas de compra.

**Campos añadidos:**
- `weight` (DECIMAL 10,3): Peso en kg para productos vendidos por peso
- `actual_price` (DECIMAL 10,2): Precio real pagado por unidad al comprar
- `estimated_price` (DECIMAL 10,2): Precio estimado por unidad basado en últimos tickets

### 2. `add_multiple_aliases_to_products.sql`
Migra el campo `alias` (singular) a `aliases` (array) para soportar múltiples nombres alternativos por producto.

**Cambios:**
- Añade columna `aliases` (TEXT[] array)
- Migra datos existentes del campo `alias` a `aliases`
- El campo `alias` se mantiene para compatibilidad hacia atrás

## Aplicar las Migraciones

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en https://supabase.com/dashboard
2. Navega a **SQL Editor**
3. Para cada migración:
   - Copia el contenido del archivo SQL
   - Pega en el editor
   - Ejecuta la query

### Opción 2: Usando Supabase CLI

```bash
supabase db push
```

### Opción 3: Manualmente con psql

```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/add_shopping_list_items_fields.sql
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/add_multiple_aliases_to_products.sql
```

## Verificar las Migraciones

```sql
-- Verificar campos en shopping_list_items
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shopping_list_items'
  AND column_name IN ('weight', 'actual_price', 'estimated_price');

-- Verificar campos en products
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('alias', 'aliases');
```

## Rollback (si es necesario)

```sql
-- Revertir add_multiple_aliases_to_products.sql
ALTER TABLE products DROP COLUMN IF EXISTS aliases;

-- Revertir add_shopping_list_items_fields.sql
ALTER TABLE shopping_list_items
DROP COLUMN IF EXISTS weight,
DROP COLUMN IF EXISTS actual_price,
DROP COLUMN IF EXISTS estimated_price;
```
DROP COLUMN IF EXISTS actual_price,
DROP COLUMN IF EXISTS estimated_price;
```
