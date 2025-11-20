# Aplicar Migración de Productos y Categorías

Para aplicar la nueva migración que añade categorías y mejora los productos:

## Opción 1: Desde el Dashboard de Supabase (Recomendado)

1. Ve a tu proyecto en https://supabase.com
2. Navega a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido completo del archivo:
   ```
   supabase/migrations/002_add_categories_and_product_enhancements.sql
   ```
5. Haz clic en **Run** para ejecutar la migración

## Opción 2: Desde la CLI de Supabase

Si tienes Supabase CLI instalado:

```bash
supabase db push
```

## Qué incluye esta migración:

### Nueva tabla `categories`
- `id`: UUID único
- `name`: Nombre de la categoría (único)
- `description`: Descripción opcional
- `icon`: Emoji o icono para la UI
- `color`: Color hex para la UI
- `keywords`: Array de palabras clave para auto-categorización

### Mejoras en tabla `products`
- ✅ `alias`: Nombre alternativo para listas de compra
- ✅ `category_id`: Relación con categorías (reemplaza el campo `category` de texto)
- ✅ `review_status`: Estado de revisión ('pending', 'uncategorized', 'reviewed')
- ✅ `last_reviewed_at`: Fecha de última revisión
- ✅ `last_reviewed_by`: Usuario que hizo la revisión

### Categorías predefinidas incluidas:
1. 🥬 Frutas y Verduras
2. 🥩 Carnes y Pescados
3. 🥛 Lácteos y Huevos
4. 🍞 Pan y Bollería
5. 🥤 Bebidas
6. 🥫 Despensa
7. ❄️ Congelados
8. 🧹 Limpieza
9. 🧴 Higiene Personal
10. 🍿 Snacks y Dulces
11. 📦 Otros

### Funcionalidad automática:
- **Auto-categorización**: Los productos se categorizan automáticamente según palabras clave
- **Trigger**: Se ejecuta al insertar o actualizar productos
- **Estado inteligente**: 
  - Si encuentra categoría → queda en 'pending'
  - Si NO encuentra categoría → queda en 'uncategorized'
  - Al revisar manualmente → cambia a 'reviewed'

## Verificar que funcionó

Ejecuta este query en el SQL Editor:

```sql
-- Ver categorías creadas
SELECT * FROM categories ORDER BY name;

-- Ver productos con su categoría
SELECT 
  p.name,
  p.alias,
  p.review_status,
  c.name as category_name,
  c.icon
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY p.name;
```

## Troubleshooting

Si ya tenías productos sin el campo `category_id`:
- La migración eliminará el campo antiguo `category` (que era texto)
- Los productos existentes quedarán sin categoría
- El trigger los intentará auto-categorizar en el próximo update
- O puedes categorizarlos manualmente desde la UI
